import time
import logging
from typing import List, Dict, Any
import httpx
from ..core.llm_router import call_llm
from .schemas import Claim, ClaimVerification, parse_verifications, validate_verification_ids

logger = logging.getLogger("trustrag.agent.fact_checker")

SYSTEM_PROMPT = """You are Agent B (Independent Fact-Checker & Verifier) in TrustRAG.
Your job:
1. Examine each claim provided by Agent A against the supplied document evidence.
2. Label every claim as supported, contradicted, or insufficient.
3. Cite only the chunk IDs that actually support or contradict the claim.
4. Do not use general model knowledge as evidence. External search results are a
   separately labelled cross-check and never replace selected-document evidence.

Return JSON only in this exact shape:
{"verifications":[{"claim_id":"claim-1","label":"supported","evidence_ids":["chunk-id"],"confidence":0.9}]}
"""

async def _verify_externally(query: str, tavily_key: str) -> List[Dict[str, str]]:
    if not tavily_key:
        return []

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_key,
                    "query": query,
                    "max_results": 3,
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
    tavily_key: str = "",
    context_chunks: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    start_time = time.time()

    claims = researcher_output.get("claim_propositions", [])
    raw_text = researcher_output.get("raw_output", "")
    external_sources = await _verify_externally(query, tavily_key)
    external_context = "\n".join(
        f"- {source['title']} ({source['url']}): {source['content']}"
        for source in external_sources
    ) or "No external sources were requested."
    document_context = "\n\n".join(
        f"[{chunk.get('chunk_id', 'unknown')}]: {chunk.get('text', '')}"
        for chunk in (context_chunks or [])
    ) or "No selected-document evidence was retrieved."

    user_prompt = f"""Query: {query}
Researcher Claims: {claims}
Researcher Synthesis:
{raw_text}

Selected-document evidence:
{document_context}

Verify every claim using its claim ID and the retrieved evidence references provided by Agent A."""
    user_prompt += f"\n\nExternal verification context (use only as a cross-check; do not treat it as user-document evidence):\n{external_context}"

    llm_output = await call_llm(
        prompt=user_prompt,
        system_prompt=SYSTEM_PROMPT,
        model=model,
        api_key_override=api_key,
        temperature=0.1,
        max_output_tokens=768,
    )

    latency_ms = int((time.time() - start_time) * 1000)

    verifications: List[ClaimVerification] = []
    parse_error = ""
    try:
        verifications = parse_verifications(llm_output)
        known_claims = [Claim.model_validate(claim) for claim in researcher_output.get("claims", [])]
        validate_verification_ids(known_claims, verifications)
    except (TypeError, ValueError) as exc:
        parse_error = str(exc)

    verification_confidence = (
        sum(item.confidence for item in verifications) / len(verifications)
        if verifications
        else 0.0
    )

    return {
        "agent_name": "fact_checker",
        "agent_role": "External Knowledge & Ground Truth Verifier",
        "model_used": model,
        "claim_propositions": [],
        "verifications": [item.model_dump() for item in verifications],
        "raw_output": llm_output,
        "confidence": verification_confidence,
        "parse_error": parse_error or None,
        "latency_ms": latency_ms,
        "sources_cited": researcher_output.get("sources_cited", []) + [
            {"source_type": "tavily", **source} for source in external_sources
        ]
    }
