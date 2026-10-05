import time
import logging
from typing import List, Dict, Any
from ..core.llm_router import call_llm
from .schemas import Claim, parse_claims

logger = logging.getLogger("trustrag.agent.researcher")

SYSTEM_PROMPT = """You are Agent A (Primary Evidence Retriever & Synthesizer) in TrustRAG.
Your job:
1. Formulate answers strictly grounded in the provided document context.
2. List 1 to 4 discrete factual claim propositions you assert.
3. Be precise, avoid assumptions not supported by the text.
4. For every claim, include the exact retrieved chunk IDs that support it.

Return JSON only in this exact shape:
{"claims":[{"claim_id":"claim-1","text":"...","evidence_ids":["chunk-id"]}]}
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
        temperature=0.1,
        max_output_tokens=512,
    )

    latency_ms = int((time.time() - start_time) * 1000)

    structured_claims: list[Claim] = []
    parse_error = ""
    try:
        structured_claims = parse_claims(llm_output)[:4]
    except ValueError as exc:
        parse_error = str(exc)

    claims = [claim.text for claim in structured_claims]

    retrieval_confidence = (
        sum(float(c.get("similarity_score", 0.0)) for c in context_chunks) / len(context_chunks)
        if context_chunks
        else 0.0
    )

    return {
        "agent_name": "retriever",
        "agent_role": "Primary Evidence & Context Extractor",
        "model_used": model,
        "claim_propositions": claims,
        "claims": [claim.model_dump() for claim in structured_claims],
        "raw_output": llm_output,
        "confidence": max(0.0, min(1.0, retrieval_confidence)) if structured_claims else 0.0,
        "parse_error": parse_error or None,
        "latency_ms": latency_ms,
        "sources_cited": [
            {
                "document_id": c.get("metadata", {}).get("document_id", ""),
                "document_name": c.get("metadata", {}).get("document_name", ""),
                "chunk_id": c.get("chunk_id", ""),
                "text": c.get("text", "")[:200],
                "similarity_score": c.get("similarity_score", 0.0),
                "page_number": c.get("metadata", {}).get("page", 0),
            }
            for c in context_chunks[:3]
        ]
    }
