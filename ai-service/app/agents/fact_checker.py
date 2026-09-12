import time
import logging
from typing import List, Dict, Any
import httpx
from ..core.llm_router import call_llm

logger = logging.getLogger("trustrag.agent.fact_checker")

SYSTEM_PROMPT = """You are Agent B (Independent Fact-Checker & Verifier) in TrustRAG.
Your job:
1. Examine the claims provided by Agent A and determine whether they align with recognized standards, external domain knowledge, and factual consistency.
2. Flag any discrepancies, overgeneralizations, or unverified claims.
"""

async def _verify_externally(query: str, tavily_key: str) -> List[Dict[str, str]]:
    if not tavily_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_key,
                    "query": query,
                    "max_results": 5,
                    "include_answer": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
            return [
                {
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "content": item.get("content", ""),
                }
                for item in payload.get("results", [])
                if item.get("url")
            ]
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("External verification unavailable: %s", exc)
        return []

async def run_fact_checker(
    query: str,
    researcher_output: Dict[str, Any],
    model: str = "llama-3.1-8b-instant",
    api_key: str = "",
    tavily_key: str = ""
) -> Dict[str, Any]:
    start_time = time.time()

    claims = researcher_output.get("claim_propositions", [])
    raw_text = researcher_output.get("raw_output", "")
    external_sources = await _verify_externally(query, tavily_key)
    external_context = "\n".join(
        f"- {source['title']} ({source['url']}): {source['content']}"
        for source in external_sources
    ) or "No external sources were requested."

    user_prompt = f"""Query: {query}
Researcher Claims: {claims}
Researcher Synthesis:
{raw_text}

Verify each claim. Conclude if they are factually accurate, consistent, and free of contradictions."""
    user_prompt += f"\n\nExternal verification context (use only as a cross-check; do not treat it as user-document evidence):\n{external_context}"

    llm_output = await call_llm(
        prompt=user_prompt,
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.1
    )

    latency_ms = int((time.time() - start_time) * 1000)

    return {
        "agent_name": "fact_checker",
        "agent_role": "External Knowledge & Ground Truth Verifier",
        "model_used": model,
        "claim_propositions": [],
        "raw_output": llm_output,
        "confidence": 0.92,
        "latency_ms": latency_ms,
        "sources_cited": researcher_output.get("sources_cited", []) + [
            {"source_type": "tavily", **source} for source in external_sources
        ]
    }
