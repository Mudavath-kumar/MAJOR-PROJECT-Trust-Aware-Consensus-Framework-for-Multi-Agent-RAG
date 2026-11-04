from app.consensus.decision import calculate_decision_score
from app.consensus.engine import compute_multi_agent_consensus


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


def _consensus_inputs(verifications, *, critic_unsupported=None):
    researcher = {
        "claims": [
            {"claim_id": "claim-1", "text": "The policy requires MFA.", "evidence_ids": ["chunk-1"]},
            {"claim_id": "claim-2", "text": "The policy requires a hardware key.", "evidence_ids": ["chunk-1"]},
        ],
        "confidence": 0.99,
    }
    fact_checker = {"verifications": verifications, "confidence": 0.01}
    critic = {
        "critic": {"risk": "low", "unsupported_claim_ids": critic_unsupported or []},
        "confidence": 0.5,
    }
    return {
        "researcher": researcher,
        "fact_checker": fact_checker,
        "critic": critic,
        "trust_assessor": {"confidence": 0.3},
        "retrieved_chunks": [{"chunk_id": "chunk-1", "similarity_score": 1.0}],
        "threshold": 80,
    }


def test_consensus_only_answers_with_retrieved_verified_evidence():
    inputs = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "supported", "evidence_ids": ["invented"], "confidence": 1.0},
            {"claim_id": "claim-2", "label": "supported", "evidence_ids": ["invented"], "confidence": 1.0},
        ]
    )

    result = compute_multi_agent_consensus(**inputs)

    assert result["decision_status"] == "abstain"
    assert result["score_components"]["claim_support"] == 0
    assert "The policy requires" not in result["synthesis"]


def test_abstention_never_displays_unverified_researcher_claims():
    inputs = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "insufficient", "evidence_ids": ["chunk-1"]},
            {"claim_id": "claim-2", "label": "insufficient", "evidence_ids": ["chunk-1"]},
        ]
    )

    result = compute_multi_agent_consensus(**inputs)

    assert result["decision_status"] == "abstain"
    assert result["synthesis"] == "I cannot answer reliably: No supporting evidence was retrieved."


def test_consensus_synthesis_contains_only_supported_claims():
    inputs = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 1.0},
            {"claim_id": "claim-2", "label": "insufficient", "evidence_ids": ["chunk-1"], "confidence": 0.1},
        ]
    )

    result = compute_multi_agent_consensus(**inputs)

    assert result["decision_status"] == "partial"
    assert result["synthesis"] == "The policy requires MFA."


def test_consensus_alignment_measures_verdict_agreement_not_confidence():
    matching = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 0.2},
            {"claim_id": "claim-2", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 0.2},
        ]
    )
    disagreement = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 0.99},
            {"claim_id": "claim-2", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 0.99},
        ],
        critic_unsupported=["claim-1", "claim-2"],
    )

    matching_result = compute_multi_agent_consensus(**matching)
    disagreement_result = compute_multi_agent_consensus(**disagreement)

    assert matching_result["agreement_ratio"] == 1.0
    assert disagreement_result["agreement_ratio"] == 0.0


def test_critic_unsupported_claim_is_not_rendered_as_an_answer():
    inputs = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 1.0},
            {"claim_id": "claim-2", "label": "supported", "evidence_ids": ["chunk-1"], "confidence": 1.0},
        ],
        critic_unsupported=["claim-2"],
    )

    result = compute_multi_agent_consensus(**inputs)

    assert result["decision_status"] == "partial"
    assert result["synthesis"] == "The policy requires MFA."
    assert result["score_components"]["critic_safety"] == 0


def test_citation_coverage_counts_claims_with_retrieved_ids_independent_of_verification():
    inputs = _consensus_inputs(
        [
            {"claim_id": "claim-1", "label": "supported", "evidence_ids": ["chunk-1"]},
            {"claim_id": "claim-2", "label": "insufficient", "evidence_ids": ["chunk-1"]},
        ]
    )
    inputs["researcher"]["claims"][1]["evidence_ids"] = ["outside-scope"]

    result = compute_multi_agent_consensus(**inputs)

    assert result["score_components"]["citation_coverage"] == 0.5
