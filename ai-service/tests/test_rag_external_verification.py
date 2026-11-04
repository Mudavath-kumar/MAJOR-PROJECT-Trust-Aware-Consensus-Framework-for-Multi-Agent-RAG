import asyncio

from app.api import rag


def _install_query_pipeline(monkeypatch, *, retrieval_quality, consensus_statuses):
    calls = {"tavily_keys": [], "critic": 0, "consensus": 0}
    monkeypatch.setattr(rag, "compute_embeddings", lambda _texts: [[0.1, 0.2]])
    monkeypatch.setattr(
        rag,
        "query_vector_store",
        lambda **_kwargs: [
            {
                "chunk_id": "doc-1:chunk-1",
                "text": "Paris is the capital of France.",
                "similarity_score": retrieval_quality,
                "metadata": {"document_name": "facts.pdf"},
            }
        ],
    )
    monkeypatch.setattr(rag.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(rag.settings, "TAVILY_API_KEY", "test-tavily-key")
    monkeypatch.setattr(rag.settings, "EXTERNAL_VERIFICATION_ENABLED", True)

    async def researcher(**_kwargs):
        return {
            "claims": [{
                "claim_id": "claim-1",
                "text": "Paris is the capital of France.",
                "evidence_ids": ["doc-1:chunk-1"],
            }],
            "sources_cited": [{
                "document_id": "doc-1",
                "document_name": "facts.pdf",
                "chunk_id": "doc-1:chunk-1",
                "text": "Paris is the capital of France.",
                "similarity_score": retrieval_quality,
            }],
        }

    async def fact_checker(**kwargs):
        calls["tavily_keys"].append(kwargs["tavily_key"])
        sources = list(kwargs["researcher_output"]["sources_cited"])
        if kwargs["tavily_key"]:
            sources.append({
                "source_type": "tavily",
                "title": "External result",
                "url": "https://web.example/source",
                "content": "Cross-check only",
            })
        return {
            "verifications": [{
                "claim_id": "claim-1",
                "label": "supported",
                "evidence_ids": ["doc-1:chunk-1"],
            }],
            "sources_cited": sources,
        }

    async def critic(**_kwargs):
        calls["critic"] += 1
        return {"critic": {"risk": "low", "unsupported_claim_ids": []}}

    def consensus(**_kwargs):
        index = calls["consensus"]
        status = consensus_statuses[min(index, len(consensus_statuses) - 1)]
        calls["consensus"] += 1
        return {
            "status": status,
            "decision_status": "answer" if status == "reached" else "partial",
            "decision_score": 0.9,
            "consensus_score": 90.0,
            "verified_evidence_ids": ["doc-1:chunk-1"],
            "synthesis": "Paris is the capital of France.",
            "evaluation_matrix": {},
        }

    monkeypatch.setattr(rag, "run_researcher", researcher)
    monkeypatch.setattr(rag, "run_fact_checker", fact_checker)
    monkeypatch.setattr(rag, "run_critic", critic)
    monkeypatch.setattr(rag, "assess_trust", lambda _chunks: {"trust_score": retrieval_quality})
    monkeypatch.setattr(rag, "compute_multi_agent_consensus", consensus)
    return calls


def _query():
    return rag.QueryRequest(
        query="What is the capital of France?",
        conversation_id="conversation-1",
        user_id="user-1",
    )


def test_production_external_check_does_not_trigger_at_threshold_and_keeps_web_out_of_citations(monkeypatch):
    calls = _install_query_pipeline(
        monkeypatch, retrieval_quality=0.75, consensus_statuses=["reached"]
    )

    result = asyncio.run(rag.query_pipeline(_query()))

    assert calls["tavily_keys"] == [""]
    assert [source["chunk_id"] for source in result["evidence_sources"]] == ["doc-1:chunk-1"]
    assert result["external_sources"] == []


def test_production_external_check_triggers_below_threshold_and_web_is_separate(monkeypatch):
    calls = _install_query_pipeline(
        monkeypatch, retrieval_quality=0.7499, consensus_statuses=["reached"]
    )

    result = asyncio.run(rag.query_pipeline(_query()))

    assert calls["tavily_keys"] == ["test-tavily-key"]
    assert len(result["external_sources"]) == 1
    assert result["external_sources"][0]["url"] == "https://web.example/source"
    assert [source["chunk_id"] for source in result["evidence_sources"]] == ["doc-1:chunk-1"]


def test_production_uses_at_most_one_bounded_retry_with_external_verification(monkeypatch):
    calls = _install_query_pipeline(
        monkeypatch, retrieval_quality=0.9, consensus_statuses=["partial", "partial", "reached"]
    )

    result = asyncio.run(rag.query_pipeline(_query()))

    assert calls["tavily_keys"] == ["", "test-tavily-key"]
    assert calls["critic"] == 1
    assert calls["consensus"] == 2
    assert result["decision_status"] == "partial"
