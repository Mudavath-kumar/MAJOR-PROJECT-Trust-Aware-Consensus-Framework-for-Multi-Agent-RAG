import json
from pathlib import Path
import sys

import pytest

from experiments.variant_runner import VariantProfile, run_variant_query


CONFIG_DIR = Path(__file__).parents[1] / "configs"


def _run_immediate(coroutine):
    """Run fake-backend coroutines without opening a Windows event-loop socket."""
    try:
        return coroutine.send(None)
    except StopIteration as completed:
        return completed.value
    raise AssertionError("fake backend unexpectedly yielded during a unit test")


class FakeBackend:
    def __init__(self):
        self.calls = []

    async def single_pass(self, query, context, profile):
        self.calls.append("single_pass")
        return {
            "answer": "Paris",
            "raw_output": '{"answer":"Paris","claims":[]}',
            "claims": [
                {"claim_id": "claim-1", "text": "The answer is Paris.", "evidence_ids": ["doc:chunk-1"]}
            ],
        }

    async def researcher(self, query, context, profile):
        self.calls.append("researcher")
        return {
            "raw_output": "research",
            "claim_propositions": ["The answer is Paris."],
            "claims": [
                {"claim_id": "claim-1", "text": "The answer is Paris.", "evidence_ids": ["doc:chunk-1"]}
            ],
        }

    async def fact_checker(self, query, researcher, context, profile):
        self.calls.append("fact_checker")
        return {
            "verifications": [
                {
                    "claim_id": "claim-1",
                    "label": "supported",
                    "evidence_ids": ["doc:chunk-1"],
                    "confidence": 0.9,
                }
            ],
            "sources_cited": [],
        }

    async def critic(self, query, researcher, fact_checker, context, profile):
        self.calls.append("critic")
        return {"critic": {"risk": "low", "confidence": 0.9}}

    async def reasoner(self, query, context, profile):
        self.calls.append("reasoner")
        return {"raw_output": "UNVERIFIED: Paris is in Europe", "confidence": 0.9}

    async def trust_assessor(self, context):
        self.calls.append("trust_assessor")
        return {"confidence": 0.9, "sources_cited": ["doc:chunk-1"]}

    async def consensus(self, researcher, fact_checker, critic, trust_assessor, context, profile):
        self.calls.append("consensus")
        return {
            "decision_status": "answer",
            "decision_score": 0.9,
            "abstention_reason": None,
            "synthesis": "Paris",
            "status": "reached",
        }


class ExternalCheckBackend(FakeBackend):
    def __init__(self, consensus_statuses=None, evidence_id="doc:chunk-1", external_available=True):
        super().__init__()
        self.consensus_statuses = list(consensus_statuses or ["reached"])
        self.external_check_calls = []
        self.consensus_calls = 0
        self.evidence_id = evidence_id
        self.external_verification_available = external_available

    async def fact_checker(self, query, researcher, context, profile):
        self.calls.append("fact_checker")
        self.external_check_calls.append(profile.external_verification)
        return {
            "verifications": [
                {
                    "claim_id": "claim-1",
                    "label": "supported",
                    "evidence_ids": [self.evidence_id],
                    "confidence": 0.9,
                }
            ],
            "sources_cited": [],
        }

    async def consensus(self, researcher, fact_checker, critic, trust_assessor, context, profile):
        self.calls.append("consensus")
        status = self.consensus_statuses[min(self.consensus_calls, len(self.consensus_statuses) - 1)]
        self.consensus_calls += 1
        decision_status = "answer" if status == "reached" else "partial"
        return {
            "decision_status": decision_status,
            "decision_score": 0.9,
            "abstention_reason": None,
            "synthesis": "Paris",
            "status": status,
        }


def _profile(filename):
    config = json.loads((CONFIG_DIR / filename).read_text(encoding="utf-8"))
    return VariantProfile.from_config(config)


def test_all_six_variants_have_distinct_stage_contracts():
    context = [
        {
            "chunk_id": "doc:chunk-1",
            "text": "Paris is the capital city.",
            "similarity_score": 0.9,
            "metadata": {"document_id": "doc", "document_name": "policy.md"},
        }
    ]
    expected = {
        "baseline-rag": (1, 0),
        "reranked-rag": (1, 0),
        "rag-verification": (2, 1),
        "multi-agent-rag": (3, 1),
        "trustrag-no-external": (5, 1),
        "trustrag": (5, 1),
    }

    for filename, (agent_stage_calls, verification_calls) in expected.items():
        backend = FakeBackend()
        prediction = _run_immediate(
            run_variant_query(_profile(f"{filename}.json"), "What is the capital?", context, backend)
        )

        assert prediction["agent_stage_calls"] == agent_stage_calls
        assert prediction["llm_calls"] == 0
        assert prediction["verification_calls"] == verification_calls
        assert prediction["retrieval_calls"] == 1
        assert prediction["predicted_evidence_ids"] == ["doc:chunk-1"]
        assert prediction["status"] == "answer"
        assert len(prediction["retrieved_evidence"]) == 1
        if filename == "baseline-rag":
            assert prediction["agent_outputs"][0]["output"]["raw_output"].startswith("{")
        if filename in {"rag-verification", "multi-agent-rag"}:
            assert prediction["predicted_answer"] == "The answer is Paris."
            assert "reasoner" not in backend.calls
        if filename == "trustrag":
            assert "reasoner" not in backend.calls
            assert prediction["critic_diagnostics"]["risk"] == "low"


def test_prediction_preserves_retrieved_passages_and_agent_raw_outputs():
    context = [
        {
            "chunk_id": "doc:chunk-1",
            "text": "Paris is the capital city.",
            "similarity_score": 0.9,
            "metadata": {"document_id": "doc", "document_name": "facts.md", "page": 3},
        }
    ]
    prediction = _run_immediate(
        run_variant_query(_profile("trustrag-no-external.json"), "What is the capital?", context, FakeBackend())
    )

    assert prediction["retrieved_evidence"] == [
        {
            "chunk_id": "doc:chunk-1",
            "text": "Paris is the capital city.",
            "similarity_score": 0.9,
            "document_id": "doc",
            "document_name": "facts.md",
            "page": 3,
        }
    ]
    outputs = {item["stage"]: item["output"] for item in prediction["agent_outputs"]}
    assert outputs["researcher"]["raw_output"] == "research"
    assert outputs["fact_checker"]["verifications"][0]["label"] == "supported"
    assert outputs["critic"]["critic"]["risk"] == "low"
    assert "reasoner" not in outputs


class UnsupportedClaimBackend(FakeBackend):
    async def fact_checker(self, query, researcher, context, profile):
        result = await super().fact_checker(query, researcher, context, profile)
        result["verifications"][0]["label"] = "insufficient"
        return result

    async def critic(self, query, researcher, fact_checker, context, profile):
        self.calls.append("critic")
        return {
            "critic": {
                "risk": "high",
                "confidence": 0.9,
                "unsupported_claim_ids": ["claim-1"],
            }
        }


def test_service_backend_critic_passes_retrieved_context_to_agent(monkeypatch):
    service_path = Path(__file__).parents[2] / "ai-service"
    if str(service_path) not in sys.path:
        sys.path.insert(0, str(service_path))
    from app.agents import critic as critic_module
    from experiments.variant_runner import ServiceBackend

    captured = {}

    async def fake_run_critic(query, researcher_output, context_chunks, model, api_key=""):
        captured.update(
            query=query,
            researcher_output=researcher_output,
            context_chunks=context_chunks,
            model=model,
            api_key=api_key,
        )
        return {"critic": {"risk": "low"}}

    monkeypatch.setattr(critic_module, "run_critic", fake_run_critic)
    context = [{"chunk_id": "doc:chunk-1", "text": "The grounded passage."}]
    researcher = {"raw_output": "claim"}
    fact_checker = {"verifications": []}
    profile = _profile("multi-agent-rag.json")
    backend = ServiceBackend(tavily_key="")

    result = _run_immediate(backend.critic("Question?", researcher, fact_checker, context, profile))

    assert result == {"critic": {"risk": "low"}}
    assert captured == {
        "query": "Question?",
        "researcher_output": researcher,
        "context_chunks": context,
        "model": profile.model,
        "api_key": "",
    }


@pytest.mark.parametrize("filename", ["rag-verification.json", "multi-agent-rag.json"])
def test_non_gated_variants_do_not_abstain_on_verifier_rejection(filename):
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris is the capital city."}]
    prediction = _run_immediate(
        run_variant_query(
            _profile(filename),
            "What is the capital?",
            context,
            UnsupportedClaimBackend(),
        )
    )

    assert prediction["predicted_answer"] == "The answer is Paris."
    assert prediction["status"] == "answer"
    assert prediction["verification_calls"] == 1
    if filename == "multi-agent-rag.json":
        assert prediction["critic_diagnostics"]["risk"] == "high"


def test_trustrag_no_external_variant_does_not_enable_external_verification():
    profile = _profile("trustrag-no-external.json")

    assert profile.external_verification is False


def test_full_trustrag_skips_initial_external_check_when_retrieval_is_strong():
    profile = _profile("trustrag.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.75}]
    backend = ExternalCheckBackend()

    _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert backend.external_check_calls == [False]
    assert backend.consensus_calls == 1


def test_full_trustrag_triggers_initial_external_check_below_retrieval_threshold():
    profile = _profile("trustrag.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.7499}]
    backend = ExternalCheckBackend()

    _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert backend.external_check_calls == [True]
    assert backend.consensus_calls == 1


def test_external_retry_recomputes_consensus_once_after_initial_low_quality_check():
    profile = _profile("trustrag.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.4}]
    backend = ExternalCheckBackend(consensus_statuses=["partial", "partial", "reached"])

    prediction = _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert backend.external_check_calls == [True]
    assert backend.consensus_calls == 2
    assert backend.calls.count("critic") == 2
    assert prediction["agent_stage_calls"] == len(prediction["agent_outputs"]) == 7


def test_full_trustrag_does_not_attempt_external_check_without_a_key():
    profile = _profile("trustrag.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.2}]
    backend = ExternalCheckBackend(external_available=False)

    _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert backend.external_check_calls == [False]
    assert backend.consensus_calls == 1


def test_no_external_variant_never_triggers_web_check_or_retry():
    profile = _profile("trustrag-no-external.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.2}]
    backend = ExternalCheckBackend(consensus_statuses=["partial", "partial"])

    _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert backend.external_check_calls == [False]
    assert backend.consensus_calls == 1


def test_full_trustrag_retries_verification_once_when_initial_consensus_is_incomplete():
    profile = _profile("trustrag.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.9}]
    backend = ExternalCheckBackend(consensus_statuses=["partial", "reached", "partial"])

    prediction = _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert backend.external_check_calls == [False, True]
    assert backend.consensus_calls == 2
    assert backend.calls.count("critic") == 2
    assert prediction["status"] == "answer"
    assert prediction["agent_stage_calls"] == len(prediction["agent_outputs"]) == 8


def test_external_verification_cannot_add_web_ids_to_document_citations():
    profile = _profile("trustrag.json")
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris", "similarity_score": 0.2}]
    backend = ExternalCheckBackend(evidence_id="https://web.example/source")

    prediction = _run_immediate(run_variant_query(profile, "Question", context, backend))

    assert prediction["predicted_evidence_ids"] == []


def test_variant_profile_rejects_unknown_execution_modes():
    with pytest.raises(ValueError, match="unsupported"):
        VariantProfile.from_config(
            {
                "name": "broken",
                "system": "broken",
                "model": "test",
                "temperature": 0.1,
                "retrieval": {"top_k": 5, "reranking": {"enabled": False}},
                "orchestration": {"mode": "unknown"},
                "verification": {"mode": "none"},
            }
        )
