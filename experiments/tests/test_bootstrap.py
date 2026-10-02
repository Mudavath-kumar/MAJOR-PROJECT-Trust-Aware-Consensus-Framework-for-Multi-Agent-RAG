from experiments.bootstrap import bootstrap_metric_ci, paired_metric_ci


def _record(record_id: str, answer: str, status: str, score: float) -> dict:
    return {
        "id": record_id,
        "answer_type": "answerable",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["c1"],
        "predicted_answer": answer,
        "retrieved_evidence_ids": ["c1"],
        "predicted_evidence_ids": ["c1"],
        "status": status,
        "decision_score": score,
        "claims": [{"supported": answer == "Paris"}],
        "latency_ms": 100,
    }


def test_bootstrap_ci_is_reproducible_for_one_run():
    records = [_record("q1", "Paris", "answer", 0.9), _record("q2", "Rome", "answer", 0.4)]

    first = bootstrap_metric_ci(records, "answer_token_f1", samples=300, seed=42)
    second = bootstrap_metric_ci(records, "answer_token_f1", samples=300, seed=42)

    assert first == second
    assert 0.0 <= first[0] <= first[1] <= 1.0


def test_paired_metric_ci_matches_records_by_id():
    baseline = [_record("q1", "Rome", "answer", 0.4), _record("q2", "Rome", "answer", 0.4)]
    trustrag = [_record("q1", "Paris", "answer", 0.9), _record("q2", "Paris", "answer", 0.9)]

    lower, upper = paired_metric_ci(baseline, trustrag, "answer_token_f1", samples=300, seed=42)

    assert lower == upper == -1.0
