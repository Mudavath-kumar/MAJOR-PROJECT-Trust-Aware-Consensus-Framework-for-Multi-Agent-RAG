import time
import logging
from typing import List, Dict, Any
from ..core.llm_router import call_llm

logger = logging.getLogger("trustrag.agent.critic")

SYSTEM_PROMPT = """You are Agent C (Hallucination & Inconsistency Auditor) in TrustRAG.
Your role:
1. Actively detect any ungrounded assertions, hallucinations, or logic leaps between the evidence and the generated claims.
2. Provide a hallucination risk assessment (Low, Medium, High).
3. If no hallucination is present, validate the final consensus safely.
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

    return {
        "agent_name": "critic",
        "agent_role": "Hallucination & Inconsistency Auditor",
        "model_used": model,
        "claim_propositions": [],
        "raw_output": llm_output,
        "confidence": 0.95,
        "latency_ms": latency_ms,
        "sources_cited": []
    }
