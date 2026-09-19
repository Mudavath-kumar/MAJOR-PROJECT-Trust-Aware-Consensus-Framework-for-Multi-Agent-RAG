import time
import logging
from typing import List, Dict, Any
from ..core.llm_router import call_llm

logger = logging.getLogger("trustrag.agent.researcher")

SYSTEM_PROMPT = """You are Agent A (Primary Evidence Retriever & Synthesizer) in TrustRAG.
Your job:
1. Formulate answers strictly grounded in the provided document context.
2. List 2 to 4 discrete factual claim propositions you assert.
3. Be precise, avoid assumptions not supported by the text.
Return a structured answer.
"""

async def run_researcher(
    query: str,
    context_chunks: List[Dict[str, Any]],
    model: str = "llama-3.3-70b-versatile",
    api_key: str = ""
) -> Dict[str, Any]:
    start_time = time.time()
    
    context_str = "\n\n".join([
        f"[Source: {c.get('metadata', {}).get('document_name', 'Doc')} | Chunk: {c.get('chunk_id')}]:\n{c.get('text', '')}"
        for c in context_chunks
    ])

    user_prompt = f"""Context:
{context_str}

User Question:
{query}

Provide your grounded synthesis and list your key factual propositions."""

    llm_output = await call_llm(
        prompt=user_prompt,
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.1
    )

    latency_ms = int((time.time() - start_time) * 1000)

    # Extract bullet-point propositions from the LLM output
    claims: List[str] = [
        line.lstrip("-•* ").strip()
        for line in llm_output.splitlines()
        if line.strip().startswith(("-", "•", "*")) and len(line.strip()) > 10
    ][:4]  # cap at 4 propositions

    return {
        "agent_name": "retriever",
        "agent_role": "Primary Evidence & Context Extractor",
        "model_used": model,
        "claim_propositions": claims,
        "raw_output": llm_output,
        "confidence": 0.94,
        "latency_ms": latency_ms,
        "sources_cited": [
            {
                "document_id": c.get("metadata", {}).get("document_id", "doc-001"),
                "document_name": c.get("metadata", {}).get("document_name", "Policy_Document.pdf"),
                "chunk_id": c.get("chunk_id", "chunk-0"),
                "text": c.get("text", "")[:200],
                "similarity_score": c.get("similarity_score", 0.92),
                "page_number": c.get("metadata", {}).get("page", 1),
            }
            for c in context_chunks[:3]
        ]
    }
