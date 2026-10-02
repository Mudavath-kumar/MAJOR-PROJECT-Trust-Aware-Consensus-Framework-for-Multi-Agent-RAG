import pytest
from pydantic import ValidationError

from app.agents.schemas import (
    Claim,
    ClaimVerification,
    CriticResult,
    parse_claims,
    parse_critic_result,
    parse_verifications,
    validate_verification_ids,
)


def test_claim_requires_evidence_ids_and_non_empty_text():
    claim = Claim(claim_id="claim-1", text="The policy requires MFA.", evidence_ids=["chunk-1"])

    assert claim.claim_id == "claim-1"
    assert claim.evidence_ids == ["chunk-1"]

    with pytest.raises(ValidationError):
        Claim(claim_id="claim-2", text="", evidence_ids=[])


def test_verification_confidence_is_bounded_and_label_is_explicit():
    verification = ClaimVerification(
        claim_id="claim-1",
        label="supported",
        evidence_ids=["chunk-1"],
        confidence=0.85,
    )

    assert verification.label == "supported"

    with pytest.raises(ValidationError):
        ClaimVerification(
            claim_id="claim-1",
            label="supported",
            evidence_ids=["chunk-1"],
            confidence=1.2,
        )


def test_critic_result_uses_structured_risk_and_confidence():
    result = CriticResult(
        risk="medium",
        unsupported_claim_ids=["claim-2"],
        confidence=0.7,
    )

    assert result.risk == "medium"
    assert result.unsupported_claim_ids == ["claim-2"]


def test_verification_ids_must_reference_known_claims():
    claims = [Claim(claim_id="claim-1", text="Supported claim.", evidence_ids=["chunk-1"])]
    verifications = [
        ClaimVerification(
            claim_id="claim-unknown",
            label="insufficient",
            evidence_ids=[],
            confidence=0.2,
        )
    ]

    with pytest.raises(ValueError, match="claim-unknown"):
        validate_verification_ids(claims, verifications)


def test_agent_json_payloads_parse_from_fenced_output():
    claims = parse_claims(
        '```json\n{"claims":[{"claim_id":"claim-1","text":"Supported.","evidence_ids":["chunk-1"]}]}\n```'
    )
    verifications = parse_verifications(
        '{"verifications":[{"claim_id":"claim-1","label":"supported","evidence_ids":["chunk-1"],"confidence":0.9}]}'
    )
    critic = parse_critic_result(
        '{"risk":"low","unsupported_claim_ids":[],"confidence":0.88}'
    )

    assert claims[0].claim_id == "claim-1"
    assert verifications[0].label == "supported"
    assert critic.risk == "low"


def test_malformed_agent_output_is_rejected_instead_of_inferred():
    with pytest.raises(ValueError, match="JSON"):
        parse_claims("The answer looks correct and confidence is high.")
