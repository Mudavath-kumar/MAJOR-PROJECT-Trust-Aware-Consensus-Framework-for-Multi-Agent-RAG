from unittest.mock import patch

from app.rag.vectorstore import query_vector_store


class _VectorSearchCollection:
    def aggregate(self, pipeline):
        assert pipeline[0]["$vectorSearch"]["filter"] == {"user_id": {"$eq": "user-1"}}
        return [
            {
                "_id": "keys",
                "text": "A primary key identifies a row; a foreign key references another table.",
                "metadata": {"document_name": "database-guide.pdf"},
                "score": 0.87,
            },
            {
                "_id": "events",
                "text": "Use Server-Sent Events or WebSockets for live updates.",
                "metadata": {"document_name": "network-guide.pdf"},
                "score": 0.84,
            },
        ]


class _AtlasUnavailableCollection:
    def aggregate(self, _pipeline):
        raise RuntimeError("Atlas vector search is unavailable")

    def find(self, _filter, _projection):
        return [
            {
                "_id": "keys",
                "text": "A primary key identifies a row; a foreign key references another table.",
                "metadata": {"document_name": "database-guide.pdf"},
                "embedding": [0.1, 0.9949874371],
            },
            {
                "_id": "events",
                "text": "Use Server-Sent Events or WebSockets for live updates.",
                "metadata": {"document_name": "network-guide.pdf"},
                "embedding": [0.84, 0.542586],
            },
        ]


def test_specific_query_drops_unrelated_vector_candidate_below_relevance_gate():
    with patch("app.rag.vectorstore._get_collection", return_value=_VectorSearchCollection()):
        results = query_vector_store(
            query_embedding=[0.1, 0.2],
            top_k=5,
            user_id="user-1",
            query_text="What is a primary key and how does it differ from a foreign key?",
        )

    assert [result["chunk_id"] for result in results] == ["keys"]
    assert results[0]["similarity_score"] == 0.87


def test_specific_query_applies_relevance_gate_when_atlas_search_falls_back():
    with patch("app.rag.vectorstore._get_collection", return_value=_AtlasUnavailableCollection()):
        results = query_vector_store(
            query_embedding=[1.0, 0.0],
            top_k=5,
            user_id="user-1",
            query_text="What is a primary key and how does it differ from a foreign key?",
        )

    assert [result["chunk_id"] for result in results] == ["keys"]
