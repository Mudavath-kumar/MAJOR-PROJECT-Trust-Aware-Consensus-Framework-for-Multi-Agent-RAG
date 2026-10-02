import json
import re
from typing import Any, Literal, Sequence

from pydantic import BaseModel, ConfigDict, Field, field_validator


DecisionStatus = Literal["answer", "partial", "abstain"]
ClaimLabel = Literal["supported", "contradicted", "insufficient"]
RiskLevel = Literal["low", "medium", "high"]


def _clean_ids(value: Sequence[str]) -> list[str]:
    cleaned = [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return list(dict.fromkeys(cleaned))


class Claim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    evidence_ids: list[str] = Field(default_factory=list)

    @field_validator("claim_id", "text", mode="before")
    @classmethod
    def strip_required_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("evidence_ids", mode="before")
    @classmethod
    def normalize_evidence_ids(cls, value: object) -> list[str]:
        if not isinstance(value, (list, tuple)):
            raise ValueError("evidence_ids must be a list")
        return _clean_ids(value)


class ClaimVerification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(min_length=1)
    label: ClaimLabel
    evidence_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("claim_id", mode="before")
    @classmethod
    def strip_claim_id(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("evidence_ids", mode="before")
    @classmethod
    def normalize_evidence_ids(cls, value: object) -> list[str]:
        if not isinstance(value, (list, tuple)):
            raise ValueError("evidence_ids must be a list")
        return _clean_ids(value)


class CriticResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    risk: RiskLevel
    unsupported_claim_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("unsupported_claim_ids", mode="before")
    @classmethod
    def normalize_claim_ids(cls, value: object) -> list[str]:
        if not isinstance(value, (list, tuple)):
            raise ValueError("unsupported_claim_ids must be a list")
        return _clean_ids(value)


class DecisionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: DecisionStatus
    decision_score: float = Field(ge=0.0, le=1.0)
    abstention_reason: str | None = None


def validate_verification_ids(
    claims: Sequence[Claim], verifications: Sequence[ClaimVerification]
) -> None:
    known_claim_ids = {claim.claim_id for claim in claims}
    unknown_ids = sorted({item.claim_id for item in verifications} - known_claim_ids)
    if unknown_ids:
        raise ValueError(f"Verifications reference unknown claims: {', '.join(unknown_ids)}")


def _decode_json_object(raw_output: str) -> dict[str, Any]:
    if not isinstance(raw_output, str) or not raw_output.strip():
        raise ValueError("Agent output must contain JSON")

    candidate = raw_output.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        candidate = fenced.group(1)
    else:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Agent output must contain JSON")
        candidate = candidate[start : end + 1]

    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ValueError("Agent output contains invalid JSON") from exc
    if not isinstance(payload, dict):
        raise ValueError("Agent output JSON must be an object")
    return payload


def parse_claims(raw_output: str) -> list[Claim]:
    payload = _decode_json_object(raw_output)
    raw_claims = payload.get("claims")
    if not isinstance(raw_claims, list):
        raise ValueError("Agent output JSON must contain a claims list")
    return [Claim.model_validate(item) for item in raw_claims]


def parse_verifications(raw_output: str) -> list[ClaimVerification]:
    payload = _decode_json_object(raw_output)
    raw_verifications = payload.get("verifications")
    if not isinstance(raw_verifications, list):
        raise ValueError("Agent output JSON must contain a verifications list")
    return [ClaimVerification.model_validate(item) for item in raw_verifications]


def parse_critic_result(raw_output: str) -> CriticResult:
    payload = _decode_json_object(raw_output)
    raw_critic = payload.get("critic")
    if isinstance(raw_critic, dict):
        payload = raw_critic
    return CriticResult.model_validate(payload)
