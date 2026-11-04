"""Research-only execution of the checked-in TrustRAG variant contracts."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
import json
from pathlib import Path
import sys
from time import perf_counter
from typing import Any, Protocol

from .runner import ORCHESTRATION_MODES, VERIFICATION_MODES


class VariantBackend(Protocol):
    external_verification_available: bool

    async def single_pass(self, query: str, context: list[dict[str, Any]], profile: "VariantProfile") -> dict[str, Any]: ...
    async def researcher(self, query: str, context: list[dict[str, Any]], profile: "VariantProfile") -> dict[str, Any]: ...
    async def fact_checker(
        self, query: str, researcher: dict[str, Any], context: list[dict[str, Any]], profile: "VariantProfile"
    ) -> dict[str, Any]: ...
    async def critic(
        self,
        query: str,
        researcher: dict[str, Any],
        fact_checker: dict[str, Any],
        context: list[dict[str, Any]],
        profile: "VariantProfile",
    ) -> dict[str, Any]: ...
    async def trust_assessor(self, context: list[dict[str, Any]]) -> dict[str, Any]: ...
    async def consensus(
        self,
        researcher: dict[str, Any],
        fact_checker: dict[str, Any],
        critic: dict[str, Any],
        trust_assessor: dict[str, Any],
        context: list[dict[str, Any]],
        profile: "VariantProfile",
    ) -> dict[str, Any]: ...


def _external_verification_profile(profile: "VariantProfile", enabled: bool) -> "VariantProfile":
    return replace(
        profile,
        external_verification=bool(profile.external_verification and enabled),
    )


def _should_trigger_external_verification(
    *, enabled: bool, api_key_available: bool, retrieval_quality: float
) -> bool:
    service_path = str(Path(__file__).resolve().parents[1] / "ai-service")
    if service_path not in sys.path:
        sys.path.insert(0, service_path)
    from app.core.verification_policy import should_trigger_external_verification

    return should_trigger_external_verification(
        enabled=enabled,
        api_key_available=api_key_available,
        retrieval_quality=retrieval_quality,
    )


@dataclass(frozen=True)
class VariantProfile:
    name: str
    system: str
    model: str
    temperature: float
    top_k: int
    orchestration_mode: str
    verification_mode: str
    reranking_enabled: bool
    external_verification: bool
    abstention_gate: bool

    @classmethod
    def from_config(cls, config: dict[str, Any]) -> "VariantProfile":
        orchestration_mode = (config.get("orchestration") or {}).get("mode")
        verification_mode = (config.get("verification") or {}).get("mode")
        retrieval = config.get("retrieval") or {}
        reranking = retrieval.get("reranking") or {}
        if orchestration_mode not in ORCHESTRATION_MODES:
            raise ValueError(f"unsupported orchestration mode: {orchestration_mode}")
        if verification_mode not in VERIFICATION_MODES:
            raise ValueError(f"unsupported verification mode: {verification_mode}")
        if not isinstance(reranking.get("enabled"), bool):
            raise ValueError("retrieval reranking enabled must be a boolean")
        return cls(
            name=str(config.get("name", "")),
            system=str(config.get("system", "")),
            model=str(config.get("model", "")),
            temperature=float(config.get("temperature", 0.1)),
            top_k=int(retrieval.get("top_k", 5)),
            orchestration_mode=orchestration_mode,
            verification_mode=verification_mode,
            reranking_enabled=reranking["enabled"],
            external_verification=bool(retrieval.get("external_verification", False)),
            abstention_gate=bool((config.get("decision") or {}).get("abstention_gate", False)),
        )


@dataclass
class PredictionRecord:
    id: str
    predicted_answer: str
    retrieved_evidence_ids: list[str]
    predicted_evidence_ids: list[str]
    status: str
    decision_score: float
    claims: list[dict[str, Any]]
    latency_ms: int
    agent_stage_calls: int
    llm_calls: int
    verification_calls: int
    retrieval_calls: int
    estimated_cost_usd: float | None = None
    abstention_reason: str | None = None
    critic_diagnostics: dict[str, Any] | None = None
    retrieved_evidence: list[dict[str, Any]] = field(default_factory=list)
    agent_outputs: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "predicted_answer": self.predicted_answer,
            "retrieved_evidence_ids": self.retrieved_evidence_ids,
            "predicted_evidence_ids": self.predicted_evidence_ids,
            "status": self.status,
            "decision_score": max(0.0, min(1.0, float(self.decision_score))),
            "claims": self.claims,
            "latency_ms": max(0, int(self.latency_ms)),
            "agent_stage_calls": max(0, int(self.agent_stage_calls)),
            "llm_calls": max(0, int(self.llm_calls)),
            "verification_calls": max(0, int(self.verification_calls)),
            "retrieval_calls": max(0, int(self.retrieval_calls)),
            "estimated_cost_usd": (
                max(0.0, float(self.estimated_cost_usd))
                if self.estimated_cost_usd is not None
                else None
            ),
            "abstention_reason": self.abstention_reason,
            "critic_diagnostics": self.critic_diagnostics,
            "retrieved_evidence": self.retrieved_evidence,
            "agent_outputs": self.agent_outputs,
        }


def _retrieved_ids(context: list[dict[str, Any]]) -> list[str]:
    return list(dict.fromkeys(str(chunk.get("chunk_id")) for chunk in context if chunk.get("chunk_id")))


def _evidence_snapshots(context: list[dict[str, Any]]) -> list[dict[str, Any]]:
    snapshots = []
    for chunk in context:
        metadata = chunk.get("metadata") or {}
        snapshots.append(
            {
                "chunk_id": str(chunk.get("chunk_id", "")),
                "text": str(chunk.get("text", "")),
                "similarity_score": chunk.get("similarity_score"),
                "document_id": str(metadata.get("document_id", "")),
                "document_name": str(metadata.get("document_name", "")),
                "page": metadata.get("page"),
            }
        )
    return snapshots


def _evidence_from_claims(claims: list[dict[str, Any]]) -> list[str]:
    evidence: list[str] = []
    for claim in claims:
        for evidence_id in claim.get("evidence_ids", []) or []:
            value = str(evidence_id)
            if value and value not in evidence:
                evidence.append(value)
    return evidence


def _verified_claims(
    researcher: dict[str, Any],
    fact_checker: dict[str, Any],
    retrieved_ids: set[str],
    critic: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    labels = {str(item.get("claim_id")): item for item in fact_checker.get("verifications", [])}
    unsupported_ids = set(
        map(str, ((critic or {}).get("critic") or {}).get("unsupported_claim_ids") or [])
    )
    claims: list[dict[str, Any]] = []
    for claim in researcher.get("claims", []) or []:
        claim_id = str(claim.get("claim_id", ""))
        verification = labels.get(claim_id, {})
        evidence_ids = list(
            dict.fromkeys(
                map(str, verification.get("evidence_ids") or claim.get("evidence_ids") or [])
            )
        )
        evidence_ids = [evidence_id for evidence_id in evidence_ids if evidence_id in retrieved_ids]
        claims.append(
            {
                "claim_id": claim_id,
                "supported": (
                    verification.get("label") == "supported"
                    and claim_id not in unsupported_ids
                    and bool(set(evidence_ids) & retrieved_ids)
                ),
                "text": str(claim.get("text", "")).strip(),
                "evidence_ids": evidence_ids,
                "verification_performed": True,
            }
        )
    return claims


def _single_pass_claims(result: dict[str, Any], retrieved_ids: set[str]) -> list[dict[str, Any]]:
    claims = []
    for claim in result.get("claims", []) or []:
        evidence_ids = list(
            dict.fromkeys(
                evidence_id
                for evidence_id in map(str, claim.get("evidence_ids") or [])
                if evidence_id in retrieved_ids
            )
        )
        claims.append(
            {
                "claim_id": str(claim.get("claim_id", "")),
                "supported": bool(set(evidence_ids) & retrieved_ids),
                "evidence_ids": evidence_ids,
                "verification_performed": False,
            }
        )
    return claims


def _support_score(claims: list[dict[str, Any]]) -> float:
    if not claims:
        return 0.0
    return sum(bool(claim.get("supported")) for claim in claims) / len(claims)


async def run_variant_query(
    profile: VariantProfile,
    query: str,
    context: list[dict[str, Any]],
    backend: VariantBackend,
    *,
    record_id: str = "query",
) -> dict[str, Any]:
    started = perf_counter()
    retrieved_ids = _retrieved_ids(context)
    if not context:
        return PredictionRecord(
            id=record_id,
            predicted_answer="",
            retrieved_evidence_ids=[],
            predicted_evidence_ids=[],
            status="abstain",
            decision_score=0.0,
            claims=[],
            latency_ms=int((perf_counter() - started) * 1000),
            agent_stage_calls=0,
            llm_calls=0,
            verification_calls=0,
            retrieval_calls=1,
            abstention_reason="No supporting evidence was retrieved.",
        ).to_dict()

    verification_calls = 0
    answer = ""
    claims: list[dict[str, Any]] = []
    cited_ids: list[str] = []
    status = "answer"
    decision_score = 0.0
    abstention_reason = None
    critic_diagnostics = None
    agent_outputs: list[dict[str, Any]] = []

    if profile.name in {"baseline-rag", "reranked-rag"}:
        generated = await backend.single_pass(query, context, profile)
        agent_outputs.append({"stage": "generator", "output": generated})
        answer = str(generated.get("answer", "")).strip()
        claims = _single_pass_claims(generated, set(retrieved_ids))
        cited_ids = _evidence_from_claims(claims)
        decision_score = _support_score(claims)
    elif profile.name == "rag-verification":
        researcher = await backend.researcher(query, context, profile)
        agent_outputs.append({"stage": "researcher", "output": researcher})
        fact_checker = await backend.fact_checker(query, researcher, context, profile)
        agent_outputs.append({"stage": "fact_checker", "output": fact_checker})
        verification_calls = 1
        claims = _verified_claims(researcher, fact_checker, set(retrieved_ids))
        cited_ids = _evidence_from_claims(claims)
        answer = " ".join(claim["text"] for claim in claims if claim["text"])
        decision_score = _support_score(claims)
        if not answer:
            status = "abstain"
            abstention_reason = "No answer claims were generated."
    elif profile.name == "multi-agent-rag":
        researcher = await backend.researcher(query, context, profile)
        agent_outputs.append({"stage": "researcher", "output": researcher})
        fact_checker = await backend.fact_checker(query, researcher, context, profile)
        agent_outputs.append({"stage": "fact_checker", "output": fact_checker})
        critic = await backend.critic(query, researcher, fact_checker, context, profile)
        agent_outputs.append({"stage": "critic", "output": critic})
        critic_diagnostics = dict(critic.get("critic") or {})
        verification_calls = 1
        claims = _verified_claims(researcher, fact_checker, set(retrieved_ids))
        cited_ids = _evidence_from_claims(claims)
        answer = " ".join(claim["text"] for claim in claims if claim["text"])
        decision_score = _support_score(claims)
        if not answer:
            status = "abstain"
            abstention_reason = "No answer claims were generated."
    elif profile.name in {"trustrag", "trustrag-no-external"}:
        researcher = await backend.researcher(query, context, profile)
        agent_outputs.append({"stage": "researcher", "output": researcher})
        retrieval_quality = sum(float(chunk.get("similarity_score", 0.0)) for chunk in context) / len(context)
        external_check_enabled = _should_trigger_external_verification(
            enabled=profile.external_verification,
            api_key_available=bool(getattr(backend, "external_verification_available", False)),
            retrieval_quality=retrieval_quality,
        )
        fact_checker_profile = _external_verification_profile(profile, external_check_enabled)
        fact_checker = await backend.fact_checker(
            query,
            researcher,
            context,
            fact_checker_profile,
        )
        agent_outputs.append(
            {
                "stage": "fact_checker",
                "external_verification": fact_checker_profile.external_verification,
                "output": fact_checker,
            }
        )
        critic = await backend.critic(query, researcher, fact_checker, context, profile)
        critic_diagnostics = dict(critic.get("critic") or {})
        agent_outputs.append({"stage": "critic", "output": critic})
        trust_assessor = await backend.trust_assessor(context)
        agent_outputs.append({"stage": "trust_assessor", "output": trust_assessor})
        consensus = await backend.consensus(
            researcher, fact_checker, critic, trust_assessor, context, profile
        )
        agent_outputs.append({"stage": "consensus", "output": consensus})
        if (
            profile.external_verification
            and bool(getattr(backend, "external_verification_available", False))
            and consensus.get("status") != "reached"
        ):
            if not external_check_enabled:
                fact_checker_profile = _external_verification_profile(profile, True)
                fact_checker = await backend.fact_checker(
                    query,
                    researcher,
                    context,
                    fact_checker_profile,
                )
                agent_outputs.append(
                    {
                        "stage": "fact_checker_retry",
                        "external_verification": fact_checker_profile.external_verification,
                        "output": fact_checker,
                    }
                )
            critic = await backend.critic(query, researcher, fact_checker, context, profile)
            critic_diagnostics = dict(critic.get("critic") or {})
            agent_outputs.append({"stage": "critic_retry", "output": critic})
            consensus = await backend.consensus(
                researcher, fact_checker, critic, trust_assessor, context, profile
            )
            agent_outputs.append({"stage": "consensus_retry", "output": consensus})
        verification_calls = 1
        claims = _verified_claims(researcher, fact_checker, set(retrieved_ids))
        cited_ids = _evidence_from_claims(claims)
        answer = str(consensus.get("synthesis", "")).strip()
        status = str(consensus.get("decision_status", "abstain"))
        decision_score = float(consensus.get("decision_score", 0.0))
        abstention_reason = consensus.get("abstention_reason")
    else:
        raise ValueError(f"unsupported variant profile: {profile.name}")

    return PredictionRecord(
        id=record_id,
        predicted_answer=answer,
        retrieved_evidence_ids=retrieved_ids,
        predicted_evidence_ids=cited_ids,
        status=status,
        decision_score=decision_score,
        claims=claims,
        latency_ms=int((perf_counter() - started) * 1000),
        agent_stage_calls=len(agent_outputs),
        llm_calls=0,
        verification_calls=verification_calls,
        retrieval_calls=1,
        abstention_reason=abstention_reason,
        critic_diagnostics=critic_diagnostics,
        retrieved_evidence=_evidence_snapshots(context),
        agent_outputs=agent_outputs,
    ).to_dict()


def _decode_json_object(raw_output: str) -> dict[str, Any]:
    candidate = raw_output.strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("single-pass output must contain a JSON object")
    payload = json.loads(candidate[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError("single-pass output must be a JSON object")
    return payload


class ServiceBackend:
    """Adapter around the existing AI-service functions for local research runs."""

    def __init__(self, tavily_key: str = "") -> None:
        service_path = str(Path(__file__).resolve().parents[1] / "ai-service")
        if service_path not in sys.path:
            sys.path.insert(0, service_path)
        from app.agents.critic import run_critic
        from app.agents.fact_checker import run_fact_checker
        from app.agents.researcher import run_researcher
        from app.agents.trust_assessor import assess_trust
        from app.consensus.engine import compute_multi_agent_consensus
        from app.core.config import settings
        from app.core.llm_router import call_llm

        self._run_critic = run_critic
        self._run_fact_checker = run_fact_checker
        self._run_researcher = run_researcher
        self._assess_trust = assess_trust
        self._compute_consensus = compute_multi_agent_consensus
        self._call_llm = call_llm
        self._tavily_key = tavily_key or settings.TAVILY_API_KEY
        self.external_verification_available = bool(self._tavily_key)

    async def single_pass(self, query, context, profile):
        context_text = "\n\n".join(
            f"[{chunk.get('chunk_id')}] {chunk.get('text', '')}" for chunk in context
        )
        raw = await self._call_llm(
            prompt=(
                f"Question: {query}\n\nEvidence:\n{context_text}\n\n"
                "Return JSON with answer and claims. Each claim must cite evidence_ids."
            ),
            system_prompt=(
                "Answer only from the supplied evidence. Return JSON exactly as "
                "{\"answer\":\"...\",\"claims\":[{\"claim_id\":\"claim-1\","
                "\"text\":\"...\",\"evidence_ids\":[\"chunk-id\"]}]}"
            ),
            model=profile.model,
            temperature=profile.temperature,
            max_output_tokens=768,
        )
        payload = _decode_json_object(raw)
        if not isinstance(payload.get("answer"), str) or not isinstance(payload.get("claims"), list):
            raise ValueError("single-pass output requires answer and claims")
        payload["raw_output"] = raw
        return payload

    async def researcher(self, query, context, profile):
        return await self._run_researcher(query=query, context_chunks=context, model=profile.model)

    async def fact_checker(self, query, researcher, context, profile):
        return await self._run_fact_checker(
            query=query,
            researcher_output=researcher,
            model=profile.model,
            tavily_key=self._tavily_key if profile.external_verification else "",
            context_chunks=context,
        )

    async def critic(self, query, researcher, fact_checker, context, profile):
        return await self._run_critic(
            query=query,
            researcher_output=researcher,
            context_chunks=context,
            model=profile.model,
        )

    async def trust_assessor(self, context):
        return self._assess_trust(context)

    async def consensus(self, researcher, fact_checker, critic, trust_assessor, context, profile):
        return self._compute_consensus(
            researcher=researcher,
            fact_checker=fact_checker,
            critic=critic,
            trust_assessor=trust_assessor,
            retrieved_chunks=context,
        )
