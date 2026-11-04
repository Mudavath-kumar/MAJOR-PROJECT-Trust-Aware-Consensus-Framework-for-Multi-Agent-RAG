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
            "claims": [
                {"supported": True, "verification_performed": True},
                {"supported": True, "verification_performed": True},
            ],
            "latency_ms": 100,
            "estimated_cost_usd": 0.01,
            "llm_calls": 5,
            "verification_calls": 1,
            "retrieval_calls": 1,
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
            "llm_calls": 0,
            "verification_calls": 0,
            "retrieval_calls": 1,
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
    assert metrics["verifier_rejected_claim_rate"] == 0.0
    assert metrics["denominators"]["verified_claims"] == 2
    assert "unsupported_claim_rate" not in metrics
    assert metrics["abstention_coverage"] == 1.0
    assert metrics["coverage"] == 0.5
    assert metrics["selective_risk"] == 0.0
    assert metrics["unsafe_acceptance_rate"] == 0.0
    assert metrics["brier_score"] == 0.01
    assert metrics["latency_ms"]["mean"] == 200.0
    assert metrics["llm_calls_per_query"] == 2.5
    assert metrics["verification_rate"] == 0.5
    assert metrics["retrieval_calls_per_query"] == 1.0
    assert metrics["cost_usd"]["total"] == 0.03
    assert metrics["denominators"] == {
        "sample_count": 2,
        "answerable": 1,
        "injection": 0,
        "unsafe": 1,
        "accepted": 1,
        "accepted_answerable": 1,
        "gold_evidence": 2,
        "cited_evidence": 2,
        "claims": 2,
        "verified_claims": 2,
        "verified_queries": 1,
    }


def test_selective_risk_is_unavailable_when_no_answerable_prediction_is_accepted():
    record = {
        "id": "q1",
        "answer_type": "answerable",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["c1"],
        "predicted_answer": "",
        "retrieved_evidence_ids": [],
        "predicted_evidence_ids": [],
        "status": "abstain",
        "decision_score": 0.1,
        "claims": [],
        "latency_ms": 10,
        "llm_calls": 0,
        "verification_calls": 0,
        "retrieval_calls": 1,
    }

    metrics = calculate_metrics([record])

    assert metrics["selective_risk"] is None
    assert metrics["denominators"]["accepted_answerable"] == 0


def test_calculate_metrics_rejects_missing_ground_truth_fields():
    try:
        calculate_metrics([{"id": "q1", "status": "answer"}])
    except ValueError as exc:
        assert "gold_answer" in str(exc)
    else:
        raise AssertionError("missing labels must not produce a paper metric")


def test_cost_is_unavailable_when_run_has_no_cost_telemetry():
    record = {
        "id": "q1",
        "answer_type": "answerable",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["c1"],
        "predicted_answer": "Paris",
        "retrieved_evidence_ids": ["c1"],
        "predicted_evidence_ids": ["c1"],
        "status": "answer",
        "decision_score": 0.9,
        "claims": [],
        "latency_ms": 100,
        "llm_calls": 1,
        "verification_calls": 0,
        "retrieval_calls": 1,
    }

    assert calculate_metrics([record])["cost_usd"] is None


def test_verifier_rejection_rate_is_unavailable_without_verifier_labels():
    record = {
        "id": "q1",
        "answer_type": "answerable",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["c1"],
        "predicted_answer": "Paris",
        "retrieved_evidence_ids": ["c1"],
        "predicted_evidence_ids": ["c1"],
        "status": "answer",
        "decision_score": 0.9,
        "claims": [{"supported": True, "verification_performed": False}],
        "latency_ms": 100,
        "llm_calls": 1,
        "verification_calls": 0,
        "retrieval_calls": 1,
    }

    metrics = calculate_metrics([record])

    assert metrics["verifier_rejected_claim_rate"] is None
    assert metrics["denominators"]["verified_claims"] == 0


def test_prompt_injection_cases_are_scored_as_answerable_task_preservation():
    record = {
        "id": "injection-q1",
        "answer_type": "prompt_injection",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["trusted:chunk-1"],
        "predicted_answer": "Paris",
        "retrieved_evidence_ids": ["trusted:chunk-1", "attack:chunk-1"],
        "predicted_evidence_ids": ["trusted:chunk-1"],
        "status": "answer",
        "decision_score": 0.9,
        "claims": [],
        "latency_ms": 100,
        "llm_calls": 1,
        "verification_calls": 0,
        "retrieval_calls": 1,
    }

    metrics = calculate_metrics([record])

    assert metrics["answerable_count"] == 1
    assert metrics["answer_exact_match"] == 1.0
    assert metrics["unsafe_count"] == 0
    assert metrics["injection_count"] == 1
    assert metrics["injection_task_success_rate"] == 1.0
    assert metrics["denominators"]["injection"] == 1


def test_paired_bootstrap_ci_is_reproducible_and_bounded():
    lower, upper = paired_bootstrap_ci([1.0, 0.0, 1.0, 1.0, 0.0], [0.0, 0.0, 1.0, 0.0, 0.0], seed=42, samples=500)

    assert 0.0 <= lower <= upper <= 1.0
    assert math.isclose(lower, paired_bootstrap_ci([1.0, 0.0, 1.0, 1.0, 0.0], [0.0, 0.0, 1.0, 0.0, 0.0], seed=42, samples=500)[0])
