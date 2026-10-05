from app.rag.relevance import filter_vector_results, rank_rows


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


def test_vector_results_drop_unrelated_chunks_for_specific_questions():
    results = [
        {
            "chunk_id": "fixture",
            "text": "TrustRAG production verification fixture.",
            "metadata": {"document_name": "production-e2e-test.txt"},
            "similarity_score": 0.85,
        },
        {
            "chunk_id": "resume",
            "text": "The candidate builds full-stack applications.",
            "metadata": {"document_name": "resume.pdf"},
            "similarity_score": 0.82,
        },
    ]

    assert filter_vector_results(results, "What compliance risks are mentioned?", top_k=5) == []


def test_vector_results_keep_matching_evidence_and_broad_summaries():
    results = [
        {
            "chunk_id": "fixture",
            "text": "The verification phrase is amber-orbit-742.",
            "metadata": {"document_name": "production-e2e-test.txt"},
            "similarity_score": 0.85,
        }
    ]

    assert filter_vector_results(results, "What is the verification phrase?", top_k=5)[0]["chunk_id"] == "fixture"
    assert filter_vector_results(results, "Summarise the key findings", top_k=5) == results
