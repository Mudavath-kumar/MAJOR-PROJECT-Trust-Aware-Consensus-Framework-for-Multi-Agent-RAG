import asyncio
import json
from pathlib import Path

import pytest

from experiments.variant_runner import VariantProfile, run_variant_query


CONFIG_DIR = Path(__file__).parents[1] / "configs"


class FakeBackend:
    def __init__(self):
        self.calls = []

    async def single_pass(self, query, context, profile):
        self.calls.append("single_pass")
        return {
            "answer": "Paris",
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

    async def critic(self, query, researcher, fact_checker, profile):
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
        "trustrag-no-external": (3, 1),
        "trustrag": (3, 1),
    }

    for filename, (llm_calls, verification_calls) in expected.items():
        backend = FakeBackend()
        prediction = asyncio.run(
            run_variant_query(_profile(f"{filename}.json"), "What is the capital?", context, backend)
        )

        assert prediction["agent_stage_calls"] == llm_calls
        assert prediction["llm_calls"] == 0
        assert prediction["verification_calls"] == verification_calls
        assert prediction["retrieval_calls"] == 1
        assert prediction["predicted_evidence_ids"] == ["doc:chunk-1"]
        assert prediction["status"] == "answer"
        if filename in {"rag-verification.json", "multi-agent-rag.json"}:
            assert prediction["predicted_answer"] == "The answer is Paris."
            assert "reasoner" not in backend.calls
        if filename == "trustrag.json":
            assert "reasoner" not in backend.calls


class UnsupportedClaimBackend(FakeBackend):
    async def fact_checker(self, query, researcher, context, profile):
        result = await super().fact_checker(query, researcher, context, profile)
        result["verifications"][0]["label"] = "insufficient"
        return result

    async def critic(self, query, researcher, fact_checker, profile):
        self.calls.append("critic")
        return {
            "critic": {
                "risk": "high",
                "confidence": 0.9,
                "unsupported_claim_ids": ["claim-1"],
            }
        }


@pytest.mark.parametrize("filename", ["rag-verification.json", "multi-agent-rag.json"])
def test_non_gated_variants_do_not_abstain_on_verifier_rejection(filename):
    context = [{"chunk_id": "doc:chunk-1", "text": "Paris is the capital city."}]
    prediction = asyncio.run(
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
