from typing import Any, Dict, List

from ..agents.schemas import DecisionResult
from .decision import calculate_decision_score, decide_answer_status


def _score(value: Any) -> float:
    if not isinstance(value, (int, float)):
        return 0.0
    normalized = float(value) / 100.0 if value > 1 else float(value)
    return max(0.0, min(1.0, normalized))


def _retrieval_quality(retrieved_chunks: List[Dict[str, Any]]) -> float:
    if not retrieved_chunks:
        return 0.0
    return round(
        sum(_score(chunk.get("similarity_score")) for chunk in retrieved_chunks)
        / len(retrieved_chunks),
        4,
    )


def _normalize_id(val: Any) -> str:
    import re
    s = str(val or "").strip().lower()
    return re.sub(r"[^a-z0-9]", "", s)


def _match_evidence_ids(candidate_ids: List[Any], retrieved_ids: set[str]) -> List[str]:
    matched = set()
    for cand in candidate_ids:
        cand_str = str(cand).strip()
        if cand_str in retrieved_ids:
            matched.add(cand_str)
        else:
            cand_norm = _normalize_id(cand_str)
            for r_id in retrieved_ids:
                r_norm = _normalize_id(r_id)
                if cand_norm and (cand_norm == r_norm or cand_norm in r_norm or r_norm.endswith(cand_norm)):
                    matched.add(r_id)
    return sorted(matched)


def _verified_claims(
    researcher: Dict[str, Any],
    fact_checker: Dict[str, Any],
    retrieved_chunks: List[Dict[str, Any]],
    critic: Dict[str, Any],
) -> List[Dict[str, Any]]:
    claims = researcher.get("claims") or []
    verifications = fact_checker.get("verifications") or []
    retrieved_ids = {
        str(chunk.get("chunk_id")) for chunk in retrieved_chunks if chunk.get("chunk_id")
    }
    verification_by_id = {item.get("claim_id"): item for item in verifications}
    for item in verifications:
        norm_key = _normalize_id(item.get("claim_id"))
        if norm_key:
            verification_by_id[norm_key] = item

    critic_unsupported_ids = set(
        map(str, (critic.get("critic") or {}).get("unsupported_claim_ids") or [])
    )
    verified = []
    for claim in claims:
        cid = claim.get("claim_id")
        verification = verification_by_id.get(cid) or verification_by_id.get(_normalize_id(cid)) or {}
        candidate_ids = list(verification.get("evidence_ids") or []) or list(claim.get("evidence_ids") or [])
        evidence_ids = _match_evidence_ids(candidate_ids, retrieved_ids)
        text = claim.get("text")
        
        is_contradicted = verification.get("label") == "contradicted"
        is_critic_unsupported = str(cid) in critic_unsupported_ids

        if (
            verification.get("label") == "supported"
            and not is_contradicted
            and not is_critic_unsupported
            and evidence_ids
            and isinstance(text, str)
            and text.strip()
        ):
            verified.append(
                {
                    "claim_id": str(cid or ""),
                    "text": text.strip(),
                    "evidence_ids": evidence_ids,
                }
            )
    return verified


def _claim_support(researcher: Dict[str, Any], verified_claims: List[Dict[str, Any]]) -> float:
    claims = researcher.get("claims") or []
    if not claims:
        return 1.0 if verified_claims else 0.0
    return round(len(verified_claims) / len(claims), 4)


def _citation_coverage(researcher: Dict[str, Any], retrieved_chunks: List[Dict[str, Any]]) -> float:
    claims = researcher.get("claims") or []
    if not claims:
        return 1.0 if retrieved_chunks else 0.0
    retrieved_ids = {str(chunk.get("chunk_id")) for chunk in retrieved_chunks}
    cited = 0
    for claim in claims:
        candidate_ids = list(claim.get("evidence_ids") or [])
        if _match_evidence_ids(candidate_ids, retrieved_ids):
            cited += 1
    return round(cited / len(claims), 4)


def _critic_safety(critic: Dict[str, Any]) -> float:
    structured = critic.get("critic") or {}
    if structured.get("unsupported_claim_ids"):
        return 0.0
    risk = structured.get("risk")
    if risk == "low":
        return 1.0
    if risk == "medium":
        return 0.5
    return 0.0


def _agreement_ratio(
    researcher: Dict[str, Any], fact_checker: Dict[str, Any], critic: Dict[str, Any]
) -> float:
    claims = researcher.get("claims") or []
    verifications = {
        item.get("claim_id"): item
        for item in (fact_checker.get("verifications") or [])
    }
    critic_result = critic.get("critic") or {}
    unsupported_ids = critic_result.get("unsupported_claim_ids")
    if not claims or not isinstance(unsupported_ids, list):
        return 0.0

    critic_unsupported = set(map(str, unsupported_ids))
    comparable = [
        (str(claim.get("claim_id", "")), verifications.get(claim.get("claim_id")))
        for claim in claims
    ]
    comparable = [(claim_id, verdict) for claim_id, verdict in comparable if verdict]
    if not comparable:
        return 0.0

    agreements = sum(
        (verdict.get("label") == "supported") == (claim_id not in critic_unsupported)
        for claim_id, verdict in comparable
    )
    return round(agreements / len(comparable), 4)


def compute_multi_agent_consensus(
    researcher: Dict[str, Any],
    fact_checker: Dict[str, Any],
    critic: Dict[str, Any],
    trust_assessor: Dict[str, Any] | None = None,
    retrieved_chunks: List[Dict[str, Any]] | None = None,
    threshold: float = 80.0,
) -> Dict[str, Any]:
    chunks = retrieved_chunks or []
    retrieval_quality = _retrieval_quality(chunks)
    verified_claims = _verified_claims(researcher, fact_checker, chunks, critic)
    claim_support = _claim_support(researcher, verified_claims)
    citation_coverage = _citation_coverage(researcher, chunks)
    critic_safety = _critic_safety(critic)
    decision_score = calculate_decision_score(
        retrieval_quality=retrieval_quality,
        claim_support=claim_support,
        citation_coverage=citation_coverage,
        critic_safety=critic_safety,
    )

    threshold_fraction = _score(threshold)
    has_contradiction = any(
        item.get("label") == "contradicted" for item in (fact_checker.get("verifications") or [])
    )
    has_grounded_claims = bool(verified_claims) or bool(researcher.get("claim_propositions") and chunks)
    decision = decide_answer_status(
        decision_score,
        threshold_fraction,
        has_evidence=has_grounded_claims,
        has_contradiction=has_contradiction,
    )

    if decision.status == "answer" and claim_support < 1.0:
        decision = DecisionResult(
            status="partial",
            decision_score=decision.decision_score,
            abstention_reason=None,
        )

    status = {
        "answer": "reached",
        "partial": "partial",
        "abstain": "failed",
    }[decision.status]
    abstention_text = decision.abstention_reason or "The evidence did not meet the decision rule."
    claim_texts = [claim["text"] for claim in verified_claims if claim.get("text")]
    # Researcher raw output is the most readable fallback — it was grounded in the
    # retrieved chunks even if the fact-checker could not verify every claim ID.
    researcher_raw = (researcher.get("raw_output") or "").strip()
    researcher_propositions = [
        p for p in (researcher.get("claim_propositions") or []) if isinstance(p, str) and p.strip()
    ]
    if decision.status == "abstain":
        if researcher_propositions and chunks:
            synthesis = " ".join(researcher_propositions)
        else:
            synthesis = f"I cannot answer reliably: {abstention_text}"
    elif claim_texts:
        synthesis = " ".join(claim_texts)
    elif researcher_raw:
        # Strip any JSON wrapper if the LLM returned raw JSON instead of prose
        import re as _re
        prose = _re.sub(r'\{[^{}]*\}', '', researcher_raw).strip()
        synthesis = prose if len(prose) > 20 else researcher_raw
    elif researcher_propositions:
        synthesis = " ".join(researcher_propositions)
    else:
        synthesis = "I cannot answer reliably: No claims were verified against retrieved evidence."

    hallucination_risk = {
        "low": "low",
        "medium": "medium",
        "high": "high",
    }.get((critic.get("critic") or {}).get("risk"), "high")
    if decision.status == "abstain":
        hallucination_risk = "high"

    agreement_ratio = _agreement_ratio(researcher, fact_checker, critic)
    evaluation_matrix = {
        "faithfulness": round(claim_support * 100, 1),
        "context_precision": round(retrieval_quality * 100, 1),
        "answer_relevance": None,
        "consensus_alignment": round(agreement_ratio * 100, 1),
        "hallucination_risk": hallucination_risk,
        "composite_confidence": round(decision_score * 100, 1),
    }

    conflicts = []
    if has_contradiction:
        conflicts.append({"reason": "At least one claim was contradicted by the verification result."})
    if decision.status == "partial":
        conflicts.append({"reason": "Evidence supports only a partial answer under the calibrated rule."})
    if decision.status == "abstain":
        conflicts.append({"reason": abstention_text})

    return {
        "status": status,
        "decision_status": decision.status,
        "decision_score": decision.decision_score,
        "abstention_reason": decision.abstention_reason,
        "score_components": {
            "retrieval_quality": retrieval_quality,
            "claim_support": claim_support,
            "citation_coverage": citation_coverage,
            "critic_safety": critic_safety,
        },
        "consensus_score": round(decision_score * 100, 1),
        "agreement_ratio": agreement_ratio,
        "verified_evidence_ids": sorted(
            {evidence_id for claim in verified_claims for evidence_id in claim["evidence_ids"]}
        ),
        "conflicts": conflicts,
        "synthesis": synthesis,
        "evaluation_matrix": evaluation_matrix,
    }
