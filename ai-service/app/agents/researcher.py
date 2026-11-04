import time
import logging
import json
import re
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


def _fallback_claims(raw_output: str, context_chunks: List[Dict[str, Any]]) -> list[Claim]:
    """Recover readable claims without turning schema fields into answer text.

    Evidence IDs are retained only when the model returned the exact ID from
    this retrieval. Plain prose has no trusted citations and must be verified
    by the fact checker before consensus can use it.
    """
    output = raw_output.strip()
    if not output:
        return []

    structured_output = re.search(
        r'["\'](?:claims|claim_id|evidence_ids)["\']\s*:', output
    ) is not None
    chunk_ids = {
        str(chunk.get("chunk_id"))
        for chunk in context_chunks
        if chunk.get("chunk_id")
    }

    def decode_json_string(token: str) -> str:
        try:
            value = json.loads(token)
        except (TypeError, json.JSONDecodeError):
            return ""
        return value if isinstance(value, str) else ""

    if structured_output:
        text_tokens = re.findall(r'"text"\s*:\s*("(?:\\.|[^"\\])*")', output)
        claim_id_tokens = re.findall(r'"claim_id"\s*:\s*("(?:\\.|[^"\\])*")', output)
        evidence_lists = re.findall(r'"evidence_ids"\s*:\s*\[([^\]]*)\]', output)
        recovered = []
        for index, text_token in enumerate(text_tokens[:4]):
            text = decode_json_string(text_token).strip()
            if not text:
                continue
            claim_id = (
                decode_json_string(claim_id_tokens[index])
                if index < len(claim_id_tokens)
                else f"claim-{index + 1}"
            )
            evidence_ids = []
            if index < len(evidence_lists):
                evidence_ids = [
                    candidate
                    for token in re.findall(r'"(?:\\.|[^"\\])*"', evidence_lists[index])
                    if (candidate := decode_json_string(token)) in chunk_ids
                ]
            recovered.append(
                Claim(
                    claim_id=claim_id or f"claim-{index + 1}",
                    text=text,
                    evidence_ids=evidence_ids,
                )
            )
        return recovered

    lines = [
        line.strip().lstrip("0123456789.-*• ")
        for line in output.splitlines()
        if len(line.strip()) > 15
    ]
    if not lines:
        lines = [
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+", output)
            if len(sentence.strip()) > 15
        ]
    return [
        Claim(claim_id=f"claim-{index + 1}", text=line, evidence_ids=[])
        for index, line in enumerate(lines[:4])
    ]

async def run_researcher(
    query: str,
    context_chunks: List[Dict[str, Any]],
    model: str = "gemini-3.5-flash",
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
        max_output_tokens=384,
    )

    latency_ms = int((time.time() - start_time) * 1000)

    structured_claims: list[Claim] = []
    parse_error = ""
    try:
        structured_claims = parse_claims(llm_output)[:4]
    except ValueError as exc:
        parse_error = str(exc)

    if not structured_claims and llm_output.strip():
        structured_claims = _fallback_claims(llm_output, context_chunks)

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
                "page_number": c.get("metadata", {}).get("page"),
            }
            for c in context_chunks[:3]
        ]
    }
