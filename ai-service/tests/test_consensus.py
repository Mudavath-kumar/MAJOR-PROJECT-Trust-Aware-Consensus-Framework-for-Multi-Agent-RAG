from app.consensus.decision import calculate_decision_score


def test_decision_score_is_weighted_from_explicit_components():
    score = calculate_decision_score(
        retrieval_quality=0.8,
        claim_support=1.0,
        citation_coverage=0.75,
        critic_safety=0.9,
    )

    assert score == 0.8775


def test_decision_score_is_clamped_to_zero_and_one():
    assert calculate_decision_score(-1, 2, 4, 3) == 0.8
    assert calculate_decision_score(-1, -2, -3, -4) == 0.0
