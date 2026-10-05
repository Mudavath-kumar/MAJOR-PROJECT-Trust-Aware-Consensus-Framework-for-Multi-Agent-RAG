from app.rag.relevance import rank_rows


def test_fallback_retrieval_combines_embedding_and_query_term_relevance():
    rows = [
        {
            "_id": "resume",
            "text": "The candidate lives in Hyderabad and works with React.",
            "embedding": [0.98, 0.02],
            "metadata": {"document_name": "resume.pdf"},
        },
        {
            "_id": "policy",
            "text": "The policy defines retention and deletion requirements.",
            "embedding": [0.10, 0.90],
            "metadata": {"document_name": "policy.pdf"},
        },
    ]

    result = rank_rows(rows, [1.0, 0.0], "Which city is listed for the candidate?", top_k=1)

    assert [chunk["chunk_id"] for chunk in result] == ["resume"]
    assert result[0]["similarity_score"] > 0.5


def test_fallback_retrieval_drops_chunks_with_no_semantic_or_lexical_signal():
    rows = [
        {
            "_id": "unrelated",
            "text": "A completely unrelated statement.",
            "embedding": [0.0, 1.0],
            "metadata": {},
        }
    ]

    assert rank_rows(rows, [1.0, 0.0], "verification phrase", top_k=5) == []
