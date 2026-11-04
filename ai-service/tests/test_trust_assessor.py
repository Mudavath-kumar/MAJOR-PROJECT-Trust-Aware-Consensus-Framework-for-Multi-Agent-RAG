from app.agents.trust_assessor import assess_trust


def test_trust_assessor_reports_mean_retrieval_similarity_and_zero_for_empty_context():
    result = assess_trust(
        [
            {"chunk_id": "c1", "similarity_score": 0.8},
            {"chunk_id": "c2", "similarity_score": 0.6},
        ]
    )

    assert result["trust_score"] == 0.7
    assert result["confidence"] == 0.7
    assert result["sources_cited"] == ["c1", "c2"]
    assert assess_trust([])["trust_score"] == 0.0
