import time
import logging
from typing import List, Dict, Any
from ..core.llm_router import call_llm
from .schemas import CriticResult, parse_critic_result

logger = logging.getLogger("trustrag.agent.critic")

SYSTEM_PROMPT = """You are Agent C (Hallucination & Inconsistency Auditor) in TrustRAG.
Your role:
1. Independently compare each researcher claim with the retrieved document passages.
   Do not rely on another agent's verification or confidence.
2. Actively detect ungrounded assertions, hallucinations, and logic leaps.
3. Provide a structured hallucination risk assessment: low, medium, or high.
4. List the claim IDs that are unsupported.
5. Never infer verification from confidence wording.

Return JSON only in this exact shape:
{"risk":"low","unsupported_claim_ids":[],"confidence":0.9}
"""

async def run_critic(
    query: str,
    researcher_output: Dict[str, Any],
    context_chunks: List[Dict[str, Any]],
    model: str = "gemini-3.5-flash",
    api_key: str = ""
) -> Dict[str, Any]:
    start_time = time.time()

    evidence = "\n\n".join(
        f"[{chunk.get('chunk_id', 'unknown')}]: {chunk.get('text', '')}"
        for chunk in context_chunks
    ) or "No retrieved evidence was available."

    user_prompt = f"""Evaluate for hallucinations and logical contradictions independently:
User Query: {query}
Agent A Output: {researcher_output.get('raw_output', '')}
Retrieved document evidence:
{evidence}

Compare the claims against the passages above. Return unsupported claim IDs and your risk verdict."""

    llm_output = await call_llm(
        prompt=user_prompt,
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.0,
        max_output_tokens=256,
    )

    latency_ms = int((time.time() - start_time) * 1000)

    structured: CriticResult | None = None
    parse_error = ""
    try:
        structured = parse_critic_result(llm_output)
    except ValueError as exc:
        parse_error = str(exc)

    return {
        "agent_name": "critic",
        "agent_role": "Hallucination & Inconsistency Auditor",
        "model_used": model,
        "claim_propositions": [],
        "raw_output": llm_output,
        "critic": structured.model_dump() if structured else None,
        "confidence": structured.confidence if structured else 0.0,
        "parse_error": parse_error or None,
        "latency_ms": latency_ms,
        "sources_cited": []
    }
