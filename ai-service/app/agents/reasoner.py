import time
from typing import Any, Dict, List
from ..core.llm_router import call_llm


SYSTEM_PROMPT = """You are TrustRAG's grounded answer agent.
Answer the user's question directly using ONLY the supplied document evidence.

Rules:
- Start with the answer. For a simple fact lookup, use one concise sentence.
- Use short paragraphs or bullet points only when they make a multi-part answer clearer.
- Cite supporting passages with the numeric references supplied in the context, such as [1] or [2].
- Do not invent details, infer motives, add career advice, or explain why a fact might matter unless the user asks.
- Do not mention agents, prompts, consensus, model confidence, or internal processing.
- Do not use Markdown heading markers (#). Bold labels and simple bullets are enough.
- If the evidence does not answer the question, say that clearly and identify the missing evidence.
- Return only the answer text; do not wrap it in a code block or a JSON object."""


async def run_reasoner(query: str, context_chunks: List[Dict[str, Any]], model: str, api_key: str = "") -> Dict[str, Any]:
    started = time.time()
    context = "\n\n".join(
        f"[{i + 1}] {chunk.get('metadata', {}).get('document_name', 'Source')} "
        f"(p.{chunk.get('metadata', {}).get('page', i + 1)}): {chunk.get('text', '')}"
        for i, chunk in enumerate(context_chunks)
    )
    output = await call_llm(
        prompt=f"User Query: {query}\n\nVerified Document Evidence Context:\n{context}\n\nAnswer the query using only these passages.",
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.1,
        max_output_tokens=768,
    )
    retrieval_confidence = (
        sum(float(chunk.get("similarity_score", 0.0)) for chunk in context_chunks) / len(context_chunks)
        if context_chunks
        else 0.0
    )
    return {
        "agent_name": "reasoner",
        "agent_role": "Grounded Reasoning & Answer Synthesizer",
        "model_used": model,
        "claim_propositions": [],
        "raw_output": output,
        "confidence": max(0.0, min(1.0, retrieval_confidence)),
        "latency_ms": int((time.time() - started) * 1000),
        "sources_cited": [chunk.get("chunk_id") for chunk in context_chunks],
    }
