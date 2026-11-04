import asyncio

import pytest

from app.api import rag


def test_query_pipeline_completes_consensus_without_a_reasoner_stage(monkeypatch):
    monkeypatch.setattr(rag, "compute_embeddings", lambda _texts: [[0.1, 0.2]])
    monkeypatch.setattr(
        rag,
        "query_vector_store",
        lambda **_kwargs: [
            {"chunk_id": "doc-1:chunk-1", "text": "Paris is the capital of France.", "similarity_score": 0.95}
        ],
    )

    async def researcher(**_kwargs):
        return {
            "claims": [
                {
                    "claim_id": "claim-1",
                    "text": "Paris is the capital of France.",
                    "evidence_ids": ["doc-1:chunk-1"],
                }
            ],
            "sources_cited": [
                {"chunk_id": "doc-1:chunk-1", "text": "Paris is the capital of France."}
            ],
        }

    async def fact_checker(**_kwargs):
        return {
            "verifications": [
                {
                    "claim_id": "claim-1",
                    "label": "supported",
                    "evidence_ids": ["doc-1:chunk-1"],
                }
            ],
            "sources_cited": [],
        }

    async def critic(**_kwargs):
        return {"critic": {"risk": "low", "unsupported_claim_ids": []}}

    monkeypatch.setattr(rag, "run_researcher", researcher)
    monkeypatch.setattr(rag, "run_fact_checker", fact_checker)
    monkeypatch.setattr(rag, "run_critic", critic)
    monkeypatch.setattr(rag, "assess_trust", lambda _chunks: {})
    monkeypatch.setattr(rag.settings, "EXTERNAL_VERIFICATION_ENABLED", False)
    monkeypatch.setattr(rag.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(rag.settings, "TAVILY_API_KEY", "")

    result = asyncio.run(
        rag.query_pipeline(
            rag.QueryRequest(query="What is France's capital?", conversation_id="c1", user_id="u1")
        )
    )

    assert result["decision_status"] == "answer"
    assert result["synthesis"] == "Paris is the capital of France."
    assert [source["chunk_id"] for source in result["evidence_sources"]] == ["doc-1:chunk-1"]


def test_fact_checker_and_critic_review_the_same_evidence_concurrently(monkeypatch):
    started = {"fact_checker": asyncio.Event(), "critic": asyncio.Event()}

    async def fact_checker(**_kwargs):
        started["fact_checker"].set()
        await started["critic"].wait()
        return {"agent_name": "fact_checker"}

    async def critic(**kwargs):
        started["critic"].set()
        await started["fact_checker"].wait()
        assert kwargs["context_chunks"] == [{"chunk_id": "chunk-1", "text": "Evidence."}]
        return {"agent_name": "critic"}

    monkeypatch.setattr(rag, "run_fact_checker", fact_checker)
    monkeypatch.setattr(rag, "run_critic", critic)

    async def run():
        return await asyncio.wait_for(
            rag.run_review_agents(
                query="Question?",
                researcher_output={"claims": []},
                context_chunks=[{"chunk_id": "chunk-1", "text": "Evidence."}],
                model="test-model",
                api_key="test-key",
                tavily_key="",
            ),
            timeout=1,
        )

    fact_checker_result, critic_result = asyncio.run(run())
    assert fact_checker_result["agent_name"] == "fact_checker"
    assert critic_result["agent_name"] == "critic"


def test_query_pipeline_sends_compact_cited_context_to_reviewers(monkeypatch):
    chunks = [
        {"chunk_id": f"chunk-{index}", "text": f"Passage {index}", "similarity_score": 0.9}
        for index in range(1, 6)
    ]
    captured = {}
    monkeypatch.setattr(rag, "compute_embeddings", lambda _texts: [[0.1, 0.2]])
    monkeypatch.setattr(rag, "query_vector_store", lambda **_kwargs: chunks)

    async def researcher(**_kwargs):
        return {
            "claims": [{"claim_id": "claim-1", "text": "Claim", "evidence_ids": ["chunk-4"]}],
            "sources_cited": [{"chunk_id": "chunk-4", "text": "Passage 4"}],
        }

    async def reviewers(**kwargs):
        captured["chunks"] = kwargs["context_chunks"]
        return {"verifications": []}, {"critic": {"risk": "low"}}

    monkeypatch.setattr(rag, "run_researcher", researcher)
    monkeypatch.setattr(rag, "run_review_agents", reviewers)
    monkeypatch.setattr(rag, "assess_trust", lambda _chunks: {})
    monkeypatch.setattr(
        rag,
        "compute_multi_agent_consensus",
        lambda **_kwargs: {
            "status": "reached",
            "synthesis": "Claim",
            "decision_status": "answer",
            "decision_score": 0.9,
            "consensus_score": 0.9,
            "verified_evidence_ids": ["chunk-4"],
            "evaluation_matrix": {},
        },
    )
    monkeypatch.setattr(rag.settings, "EXTERNAL_VERIFICATION_ENABLED", False)
    monkeypatch.setattr(rag.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(rag.settings, "TAVILY_API_KEY", "")

    asyncio.run(
        rag.query_pipeline(
            rag.QueryRequest(query="Question?", conversation_id="c1", user_id="u1")
        )
    )

    selected_ids = [chunk["chunk_id"] for chunk in captured["chunks"]]
    assert "chunk-4" in selected_ids
    assert len(selected_ids) == 3
