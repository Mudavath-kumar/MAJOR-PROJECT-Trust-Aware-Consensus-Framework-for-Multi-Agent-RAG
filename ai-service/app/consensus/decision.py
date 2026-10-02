from typing import Any

from ..agents.schemas import DecisionResult


DEFAULT_WEIGHTS = {
    "claim_support": 0.35,
    "citation_coverage": 0.25,
    "retrieval_quality": 0.20,
    "critic_safety": 0.20,
}


def _bounded(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def calculate_decision_score(
    retrieval_quality: float,
    claim_support: float,
    citation_coverage: float,
    critic_safety: float,
    weights: dict[str, float] | None = None,
) -> float:
    selected_weights = weights or DEFAULT_WEIGHTS
    total_weight = sum(_bounded(selected_weights.get(name, 0.0)) for name in DEFAULT_WEIGHTS)
    if total_weight <= 0:
        return 0.0

    components = {
        "retrieval_quality": _bounded(retrieval_quality),
        "claim_support": _bounded(claim_support),
        "citation_coverage": _bounded(citation_coverage),
        "critic_safety": _bounded(critic_safety),
    }
    weighted = sum(
        components[name] * _bounded(selected_weights.get(name, 0.0))
        for name in DEFAULT_WEIGHTS
    )
    return round(max(0.0, min(1.0, weighted / total_weight)), 4)


def decide_answer_status(
    decision_score: float,
    threshold: float,
    *,
    has_evidence: bool,
    has_contradiction: bool,
) -> DecisionResult:
    score = _bounded(decision_score)
    calibrated_threshold = max(0.0, min(1.0, float(threshold)))

    if not has_evidence:
        return DecisionResult(
            status="abstain",
            decision_score=score,
            abstention_reason="No supporting evidence was retrieved.",
        )
    if has_contradiction:
        return DecisionResult(
            status="abstain",
            decision_score=score,
            abstention_reason="Retrieved evidence contains a contradiction.",
        )
    partial_floor = max(0.0, calibrated_threshold - 0.20)
    if score < partial_floor:
        return DecisionResult(
            status="abstain",
            decision_score=score,
            abstention_reason="Decision score is below the calibrated threshold.",
        )
    if score < calibrated_threshold:
        return DecisionResult(status="partial", decision_score=score)
    return DecisionResult(status="answer", decision_score=score)
