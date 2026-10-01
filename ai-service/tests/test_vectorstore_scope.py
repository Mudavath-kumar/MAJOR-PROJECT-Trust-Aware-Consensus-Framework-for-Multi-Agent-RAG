import unittest

from app.rag.vectorstore import build_scope_filter


class VectorStoreScopeTests(unittest.TestCase):
    def test_document_scope_always_contains_user_scope(self):
        self.assertEqual(
            build_scope_filter(["doc-1", "doc-2"], "user-1"),
            {"user_id": "user-1", "document_id": {"$in": ["doc-1", "doc-2"]}},
        )

    def test_user_scope_is_present_for_unscoped_queries(self):
        self.assertEqual(build_scope_filter(None, "user-1"), {"user_id": "user-1"})


if __name__ == "__main__":
    unittest.main()

