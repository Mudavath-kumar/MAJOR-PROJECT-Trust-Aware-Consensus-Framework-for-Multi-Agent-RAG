import math

from experiments.metrics import calculate_metrics, paired_bootstrap_ci


def test_calculate_metrics_reports_groundedness_retrieval_calibration_and_latency():
    records = [
        {
            "id": "q1",
            "answer_type": "answerable",
            "gold_answer": "Paris",
            "gold_evidence_ids": ["c1", "c2"],
            "predicted_answer": "Paris",
            "retrieved_evidence_ids": ["c1", "c3"],
            "predicted_evidence_ids": ["c1", "c3"],
            "status": "answer",
            "decision_score": 0.9,
            "claims": [{"supported": True}, {"supported": True}],
            "latency_ms": 100,
            "estimated_cost_usd": 0.01,
        },
        {
            "id": "q2",
            "answer_type": "unanswerable",
            "gold_answer": "",
            "gold_evidence_ids": [],
            "predicted_answer": "",
            "retrieved_evidence_ids": [],
            "predicted_evidence_ids": [],
            "status": "abstain",
            "decision_score": 0.1,
            "claims": [],
            "latency_ms": 300,
            "estimated_cost_usd": 0.02,
        },
    ]

    metrics = calculate_metrics(records, k=2)

    assert metrics["sample_count"] == 2
    assert metrics["answerable_count"] == 1
    assert metrics["answer_exact_match"] == 1.0
    assert metrics["answer_token_f1"] == 1.0
    assert metrics["retrieval_recall_at_k"] == 0.5
    assert metrics["citation_precision"] == 0.5
    assert metrics["citation_recall"] == 0.5
    assert metrics["abstention_coverage"] == 1.0
    assert metrics["coverage"] == 0.5
    assert metrics["selective_risk"] == 0.0
    assert metrics["unsafe_acceptance_rate"] == 0.0
    assert metrics["brier_score"] == 0.01
    assert metrics["latency_ms"]["mean"] == 200.0
    assert metrics["cost_usd"]["total"] == 0.03
    assert metrics["denominators"] == {
        "sample_count": 2,
        "answerable": 1,
        "unsafe": 1,
        "accepted": 1,
        "accepted_answerable": 1,
        "gold_evidence": 2,
        "claims": 2,
    }


def test_calculate_metrics_rejects_missing_ground_truth_fields():
    try:
        calculate_metrics([{"id": "q1", "status": "answer"}])
    except ValueError as exc:
        assert "gold_answer" in str(exc)
    else:
        raise AssertionError("missing labels must not produce a paper metric")


def test_paired_bootstrap_ci_is_reproducible_and_bounded():
    lower, upper = paired_bootstrap_ci([1.0, 0.0, 1.0, 1.0, 0.0], [0.0, 0.0, 1.0, 0.0, 0.0], seed=42, samples=500)

    assert 0.0 <= lower <= upper <= 1.0
    assert math.isclose(lower, paired_bootstrap_ci([1.0, 0.0, 1.0, 1.0, 0.0], [0.0, 0.0, 1.0, 0.0, 0.0], seed=42, samples=500)[0])
