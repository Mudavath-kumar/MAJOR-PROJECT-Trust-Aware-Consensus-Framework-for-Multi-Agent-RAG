import time
import logging
from typing import List, Dict, Any
from ..core.llm_router import call_llm
from .schemas import CriticResult, parse_critic_result

logger = logging.getLogger("trustrag.agent.critic")

SYSTEM_PROMPT = """You are Agent C (Hallucination & Inconsistency Auditor) in TrustRAG.
Your role:
1. Actively detect any ungrounded assertions, hallucinations, or logic leaps between the evidence and the generated claims.
2. Provide a structured hallucination risk assessment: low, medium, or high.
3. List the claim IDs that are unsupported.
4. Never infer verification from confidence wording.

Return JSON only in this exact shape:
{"risk":"low","unsupported_claim_ids":[],"confidence":0.9}
"""

async def run_critic(
    query: str,
    researcher_output: Dict[str, Any],
    fact_checker_output: Dict[str, Any],
    model: str = "llama-3.3-70b-versatile",
    api_key: str = ""
) -> Dict[str, Any]:
    start_time = time.time()

    user_prompt = f"""Evaluate for hallucinations and logical contradictions:
User Query: {query}
Agent A Output: {researcher_output.get('raw_output', '')}
Agent B Output: {fact_checker_output.get('raw_output', '')}

Audit for unsupported leaps and give your critique verdict."""

    llm_output = await call_llm(
        prompt=user_prompt,
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.0
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
