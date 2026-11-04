from app.agents.context import select_review_context_chunks


def test_review_context_prioritizes_researcher_citations_then_fills_by_retrieval_rank():
    chunks = [
        {"chunk_id": f"chunk-{index}", "text": f"Evidence {index}"}
        for index in range(1, 6)
    ]
    researcher = {
        "claims": [
            {"claim_id": "claim-1", "evidence_ids": ["chunk-4"]},
            {"claim_id": "claim-2", "evidence_ids": ["chunk-1"]},
        ]
    }

    selected = select_review_context_chunks(researcher, chunks, max_chunks=3)

    assert [chunk["chunk_id"] for chunk in selected] == ["chunk-1", "chunk-4", "chunk-2"]
    assert len(chunks) == 5


def test_review_context_uses_top_retrieval_results_when_researcher_has_no_citations():
    chunks = [
        {"chunk_id": f"chunk-{index}", "text": f"Evidence {index}"}
        for index in range(1, 5)
    ]

    selected = select_review_context_chunks({"claims": []}, chunks, max_chunks=2)

    assert [chunk["chunk_id"] for chunk in selected] == ["chunk-1", "chunk-2"]


def test_review_context_handles_missing_ids_and_empty_results():
    chunks = [{"text": "No stable id"}, {"chunk_id": "chunk-1", "text": "Evidence"}]

    selected = select_review_context_chunks(
        {"claims": [{"evidence_ids": ["missing"]}]}, chunks, max_chunks=3
    )

    assert selected == [{"chunk_id": "chunk-1", "text": "Evidence"}]
    assert select_review_context_chunks({}, [], max_chunks=3) == []
