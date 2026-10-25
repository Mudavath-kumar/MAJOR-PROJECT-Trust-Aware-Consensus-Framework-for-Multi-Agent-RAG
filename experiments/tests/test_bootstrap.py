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
        "llm_calls": 1,
        "verification_calls": 0,
        "retrieval_calls": 1,
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


def _labelled_record(record_id: str, answer_type: str, answer: str, status: str) -> dict:
    answerable = answer_type == "answerable"
    return {
        "id": record_id,
        "answer_type": answer_type,
        "gold_answer": "Paris" if answerable else "",
        "gold_evidence_ids": ["c1"] if answerable else [],
        "predicted_answer": answer,
        "retrieved_evidence_ids": ["c1"] if answerable else [],
        "predicted_evidence_ids": ["c1"] if answerable else [],
        "status": status,
        "decision_score": 0.9 if answerable else 0.1,
        "claims": [],
        "latency_ms": 100,
        "llm_calls": 1,
        "verification_calls": 0,
        "retrieval_calls": 1,
    }


def test_paired_bootstrap_recomputes_subgroup_metrics_on_stratified_pairs():
    system = [
        _labelled_record("a1", "answerable", "Paris", "answer"),
        _labelled_record("a2", "answerable", "Paris", "answer"),
        _labelled_record("u1", "unanswerable", "", "abstain"),
        _labelled_record("u2", "unanswerable", "", "abstain"),
    ]
    baseline = [
        _labelled_record("a1", "answerable", "Rome", "answer"),
        _labelled_record("a2", "answerable", "Rome", "answer"),
        _labelled_record("u1", "unanswerable", "", "abstain"),
        _labelled_record("u2", "unanswerable", "", "abstain"),
    ]

    lower, upper = paired_metric_ci(system, baseline, "answer_token_f1", samples=50, seed=3)

    assert lower == upper == 1.0


def test_paired_bootstrap_rejects_pairs_with_different_gold_strata():
    first = [_labelled_record("q1", "answerable", "Paris", "answer")]
    second = [_labelled_record("q1", "unanswerable", "", "abstain")]

    try:
        paired_metric_ci(first, second, "answer_token_f1", samples=10)
    except ValueError as error:
        assert "answer_type" in str(error)
    else:
        raise AssertionError("mismatched answerability labels must be rejected")


def test_paired_bootstrap_rejects_different_gold_answers_with_same_stratum():
    first = [_labelled_record("q1", "answerable", "Paris", "answer")]
    second = [_labelled_record("q1", "answerable", "London", "answer")]
    second[0]["gold_answer"] = "London"

    try:
        paired_metric_ci(first, second, "answer_token_f1", samples=10)
    except ValueError as error:
        assert "gold_answer" in str(error)
    else:
        raise AssertionError("paired runs must use identical gold answers")
