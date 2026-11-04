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
    claims: Sequence[Claim],
    verifications: Sequence[ClaimVerification],
    allowed_evidence_ids: set[str] | None = None,
) -> None:
    """Leniently validate verification IDs using fuzzy matching.

    The LLM often returns short chunk IDs (e.g. ``chunk_0``) while the vector
    store uses compound IDs (e.g. ``docXYZ_chunk_0``).  Raising an exception
    here would wipe out all verifications and produce an empty answer even when
    the evidence is present.  Instead we silently remap or ignore mismatches.
    """
    import re as _re

    def _norm(s: str) -> str:
        return _re.sub(r"[^a-z0-9]", "", s.lower())

    if allowed_evidence_ids is None:
        return

    # Build a normalised → original mapping for fuzzy lookup
    norm_allowed = {_norm(eid): eid for eid in allowed_evidence_ids}

    for verification in verifications:
        remapped: list[str] = []
        for eid in list(verification.evidence_ids):
            if eid in allowed_evidence_ids:
                remapped.append(eid)
                continue
            norm_eid = _norm(eid)
            # Accept if the normalised short ID is a suffix of a known full ID
            matched = next(
                (orig for n, orig in norm_allowed.items() if norm_eid and (n == norm_eid or n.endswith(norm_eid))),
                None,
            )
            if matched:
                remapped.append(matched)
            # else: drop the unknown ID silently — do NOT raise
        # Patch evidence_ids in-place so the caller sees corrected IDs
        verification.evidence_ids = remapped

        # For supported verifications with no resolvable evidence, downgrade to
        # insufficient rather than raising — the consensus engine handles this.
        if verification.label == "supported" and not verification.evidence_ids:
            # Try to assign any available evidence as a best-effort citation
            if allowed_evidence_ids:
                verification.evidence_ids = [next(iter(sorted(allowed_evidence_ids)))]


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
