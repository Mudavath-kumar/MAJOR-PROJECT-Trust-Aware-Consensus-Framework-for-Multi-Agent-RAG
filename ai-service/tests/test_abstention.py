from app.consensus.decision import decide_answer_status


def test_high_score_with_evidence_returns_answer():
    result = decide_answer_status(0.92, 0.80, has_evidence=True, has_contradiction=False)

    assert result.status == "answer"
    assert result.abstention_reason is None


def test_medium_score_with_evidence_returns_partial():
    result = decide_answer_status(0.65, 0.80, has_evidence=True, has_contradiction=False)

    assert result.status == "partial"
    assert result.abstention_reason is None


def test_contradictory_or_missing_evidence_abstains_even_with_high_score():
    contradictory = decide_answer_status(0.92, 0.80, has_evidence=True, has_contradiction=True)
    missing = decide_answer_status(0.92, 0.80, has_evidence=False, has_contradiction=False)

    assert contradictory.status == "abstain"
    assert "contradict" in (contradictory.abstention_reason or "")
    assert missing.status == "abstain"
    assert "evidence" in (missing.abstention_reason or "")


def test_low_score_abstains():
    result = decide_answer_status(0.59, 0.80, has_evidence=True, has_contradiction=False)

    assert result.status == "abstain"
    assert "threshold" in (result.abstention_reason or "")
