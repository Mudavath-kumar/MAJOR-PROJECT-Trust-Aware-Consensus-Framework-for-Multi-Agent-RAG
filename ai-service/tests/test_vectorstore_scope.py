import unittest
from unittest.mock import patch

from app.rag.vectorstore import build_scope_filter, query_vector_store


class VectorStoreScopeTests(unittest.TestCase):
    def test_document_scope_always_contains_user_scope(self):
        self.assertEqual(
            build_scope_filter(["doc-1", "doc-2"], "user-1"),
            {"user_id": "user-1", "document_id": {"$in": ["doc-1", "doc-2"]}},
        )

    def test_user_scope_is_present_for_unscoped_queries(self):
        self.assertEqual(build_scope_filter(None, "user-1"), {"user_id": "user-1"})

    def test_explicit_empty_document_scope_matches_no_documents(self):
        self.assertEqual(
            build_scope_filter([], "user-1"),
            {"user_id": "user-1", "document_id": {"$in": []}},
        )

    def test_empty_document_scope_returns_without_searching_the_vector_store(self):
        with patch("app.rag.vectorstore._get_collection", side_effect=AssertionError("must not query")):
            self.assertEqual(query_vector_store([], document_ids=[], user_id="user-1"), [])


if __name__ == "__main__":
    unittest.main()
