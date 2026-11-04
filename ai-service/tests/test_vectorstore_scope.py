import unittest
from unittest.mock import patch

from app.rag.vectorstore import (
    build_scope_filter,
    delete_document_chunks,
    get_document_chunks,
    query_vector_store,
)


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

    def test_chunk_listing_requires_a_tenant_scope(self):
        with patch("app.rag.vectorstore._get_collection", side_effect=AssertionError("must not query")):
            with self.assertRaisesRegex(ValueError, "user_id is required"):
                get_document_chunks("doc-1", user_id="")

    def test_chunk_deletion_requires_a_tenant_scope(self):
        with patch("app.rag.vectorstore._get_collection", side_effect=AssertionError("must not query")):
            with self.assertRaisesRegex(ValueError, "user_id is required"):
                delete_document_chunks("doc-1", user_id="")


if __name__ == "__main__":
    unittest.main()
