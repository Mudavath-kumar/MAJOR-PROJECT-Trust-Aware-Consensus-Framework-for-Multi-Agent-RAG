from typing import Any, Dict, List

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


def _claim_support(researcher: Dict[str, Any], fact_checker: Dict[str, Any]) -> float:
    claims = researcher.get("claims") or []
    verifications = fact_checker.get("verifications") or []
    if not claims or not verifications:
        return 0.0
    labels = {item.get("claim_id"): item.get("label") for item in verifications}
    supported = sum(labels.get(claim.get("claim_id")) == "supported" for claim in claims)
    return round(supported / len(claims), 4)


def _citation_coverage(researcher: Dict[str, Any], retrieved_chunks: List[Dict[str, Any]]) -> float:
    claims = researcher.get("claims") or []
    if not claims:
        return 0.0
    retrieved_ids = {str(chunk.get("chunk_id")) for chunk in retrieved_chunks}
    cited = sum(
        bool(set(map(str, claim.get("evidence_ids") or [])) & retrieved_ids)
        for claim in claims
    )
    return round(cited / len(claims), 4)


def _critic_safety(critic: Dict[str, Any]) -> float:
    structured = critic.get("critic") or {}
    risk = structured.get("risk")
    if risk == "low":
        return 1.0
    if risk == "medium":
        return 0.5
    return 0.0


def _agreement_ratio(*agents: Dict[str, Any]) -> float:
    confidences = [_score(agent.get("confidence")) for agent in agents if agent]
    positive = [value for value in confidences if value > 0]
    return round(sum(positive) / len(positive), 4) if positive else 0.0


def compute_multi_agent_consensus(
    researcher: Dict[str, Any],
    fact_checker: Dict[str, Any],
    critic: Dict[str, Any],
    trust_assessor: Dict[str, Any] | None = None,
    reasoner: Dict[str, Any] | None = None,
    retrieved_chunks: List[Dict[str, Any]] | None = None,
    threshold: float = 80.0,
) -> Dict[str, Any]:
    chunks = retrieved_chunks or []
    retrieval_quality = _retrieval_quality(chunks)
    claim_support = _claim_support(researcher, fact_checker)
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
    decision = decide_answer_status(
        decision_score,
        threshold_fraction,
        has_evidence=bool(chunks and researcher.get("claims") and fact_checker.get("verifications")),
        has_contradiction=has_contradiction,
    )

    status = {
        "answer": "reached",
        "partial": "partial",
        "abstain": "failed",
    }[decision.status]
    reasoner_output = (reasoner or {}).get("raw_output", "") or ""
    abstention_text = decision.abstention_reason or "The evidence did not meet the decision rule."
    synthesis = reasoner_output.strip() if decision.status != "abstain" else f"I cannot answer reliably: {abstention_text}"

    hallucination_risk = {
        "low": "low",
        "medium": "medium",
        "high": "high",
    }.get((critic.get("critic") or {}).get("risk"), "high")
    if decision.status == "abstain":
        hallucination_risk = "high"

    agreement_ratio = _agreement_ratio(researcher, fact_checker, critic, trust_assessor or {}, reasoner or {})
    evaluation_matrix = {
        "faithfulness": round(claim_support * 100, 1),
        "context_precision": round(retrieval_quality * 100, 1),
        "answer_relevance": round(_score((reasoner or {}).get("confidence")) * 100, 1),
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
        "conflicts": conflicts,
        "synthesis": synthesis,
        "evaluation_matrix": evaluation_matrix,
    }
