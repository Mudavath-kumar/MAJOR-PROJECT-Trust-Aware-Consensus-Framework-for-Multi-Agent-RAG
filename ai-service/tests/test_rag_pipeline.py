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
