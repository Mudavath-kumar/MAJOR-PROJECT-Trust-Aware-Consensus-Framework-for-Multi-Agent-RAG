import time
from typing import Any, Dict, List
from ..core.llm_router import call_llm


SYSTEM_PROMPT = """You are TrustRAG's Senior Grounded Reasoning Agent.
Your responsibility is to synthesize a professional, beautifully structured, and strictly evidence-grounded answer based ONLY on the provided context.

Formatting Guidelines:
- Format your response with clean GitHub Markdown (headings, bullet points, bold highlights).
- Structure your answer dynamically based on the user's question:
  1. **Executive Summary**: A direct 1-3 sentence answer addressing the core question immediately.
  2. **Key Verified Findings**: Structured bullet points with bold sub-headers and inline citations (e.g. `[DocName, p.X]` or `[chunk_id]`).
  3. **Analysis & Technical Nuance**: Deeper evaluation of requirements, metrics, architectural details, or policy implications.
  4. **Verification Status**: Explicit note stating that findings are derived strictly from authenticated documents, highlighting any unverified assumptions or caveats.
- If the evidence is insufficient or contradictory, explicitly abstain or state the boundaries of the retrieved knowledge.
- Never fabricate data, external facts, or unsupported claims."""


async def run_reasoner(query: str, context_chunks: List[Dict[str, Any]], model: str, api_key: str = "") -> Dict[str, Any]:
    started = time.time()
    context = "\n\n".join(
        f"[{chunk.get('chunk_id', f'chunk_{i}')} | {chunk.get('document_name', 'Source')} (p.{chunk.get('page_number', 1)})]: {chunk.get('text', '')}"
        for i, chunk in enumerate(context_chunks)
    )
    output = await call_llm(
        prompt=f"User Query: {query}\n\nVerified Document Evidence Context:\n{context}\n\nPlease synthesize a structured, grounded answer following the formatting guidelines.",
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.1,
    )
    return {
        "agent_name": "reasoner",
        "agent_role": "Grounded Reasoning & Answer Synthesizer",
        "model_used": model,
        "claim_propositions": [],
        "raw_output": output,
        "confidence": 0.0 if not context_chunks else 0.88,
        "latency_ms": int((time.time() - started) * 1000),
        "sources_cited": [chunk.get("chunk_id") for chunk in context_chunks],
    }

