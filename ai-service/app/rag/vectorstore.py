import logging
from typing import List, Dict, Any, Optional
from ..core.config import settings
from .relevance import filter_vector_results, rank_rows

logger = logging.getLogger("trustrag.vectorstore")

_col = None  # pymongo Collection


def build_scope_filter(document_ids: Optional[List[str]], user_id: str) -> Dict[str, Any]:
    """Build a tenant-scoped Mongo filter for both vector and fallback search."""
    if not user_id:
        raise ValueError("user_id is required for vector retrieval")

    scope: Dict[str, Any] = {"user_id": user_id}
    ids = [str(document_id) for document_id in (document_ids or []) if str(document_id).strip()]
    if len(ids) == 1:
        scope["document_id"] = ids[0]
    elif ids:
        scope["document_id"] = {"$in": ids}
    return scope


def _get_collection():
    global _col
    if _col is not None:
        return _col
    from pymongo import MongoClient
    from pymongo.operations import SearchIndexModel

    client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=10000)
    try:
        db = client.get_default_database()
    except Exception:
        db = client["trustrag"]
    _col = db["chunks"]

    # Ensure a vector search index exists (Atlas only — silently ignored on local)
    try:
        existing = [idx["name"] for idx in _col.list_search_indexes()]
        if "embedding_index" not in existing:
            _col.create_search_index(SearchIndexModel(
                definition={
                    "fields": [
                        {
                            "type": "vector",
                            "path": "embedding",
                            "numDimensions": 384,
                            "similarity": "cosine",
                        },
                        {"type": "filter", "path": "document_id"},
                        {"type": "filter", "path": "user_id"},
                    ]
                },
                name="embedding_index",
                type="vectorSearch",
            ))
            logger.info("Created Atlas vector search index: embedding_index")
    except Exception as e:
        logger.warning("Vector search index setup skipped (local/non-Atlas): %s", e)

    return _col


def add_document_chunks(
    chunk_ids: List[str],
    embeddings: List[List[float]],
    documents: List[str],
    metadatas: List[Dict[str, Any]],
) -> None:
    col = _get_collection()
    docs = [
        {
            "_id": chunk_ids[i],
            "text": documents[i],
            "embedding": embeddings[i],
            "metadata": metadatas[i],
            "document_id": metadatas[i].get("document_id", ""),
            "user_id": metadatas[i].get("user_id", ""),
        }
        for i in range(len(chunk_ids))
    ]
    if not docs:
        return
    from pymongo import ReplaceOne
    ops = [ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in docs]
    col.bulk_write(ops, ordered=False)


def delete_document_chunks(document_id: str, user_id: Optional[str] = None) -> int:
    col = _get_collection()
    filt: Dict[str, Any] = {"document_id": document_id}
    if user_id:
        filt["user_id"] = user_id
    result = col.delete_many(filt)
    return result.deleted_count


def get_document_chunks(document_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    col = _get_collection()
    filt: Dict[str, Any] = {"document_id": document_id}
    if user_id:
        filt["user_id"] = user_id
    rows = col.find(filt, {"embedding": 0})
    return [
        {"chunk_id": str(r["_id"]), "text": r["text"], "metadata": r.get("metadata", {})}
        for r in rows
    ]


def query_vector_store(
    query_embedding: List[float],
    top_k: int = 5,
    document_ids: Optional[List[str]] = None,
    user_id: Optional[str] = None,
    query_text: str = "",
) -> List[Dict[str, Any]]:
    col = _get_collection()

    if not user_id:
        raise ValueError("user_id is required for vector retrieval")

    scope_filter = build_scope_filter(document_ids, user_id)
    pre_filter: Dict[str, Any] = {
        key: (value if key != "user_id" else {"$eq": value})
        for key, value in scope_filter.items()
    }

    # Try Atlas Vector Search first
    try:
        vs_stage: Dict[str, Any] = {
            "index": "embedding_index",
            "path": "embedding",
            "queryVector": query_embedding,
            "numCandidates": top_k * 10,
            "limit": top_k,
        }
        if pre_filter:
            vs_stage["filter"] = pre_filter

        results = list(col.aggregate([
            {"$vectorSearch": vs_stage},
            {"$project": {"_id": 1, "text": 1, "metadata": 1, "score": {"$meta": "vectorSearchScore"}}},
        ]))
        if results:
            logger.info("Atlas vectorSearch returned %d chunks", len(results))
            vector_results = [
                {
                    "chunk_id": str(r["_id"]),
                    "text": r["text"],
                    "metadata": r.get("metadata", {}),
                    "similarity_score": round(float(r.get("score", 0.8)), 4),
                }
                for r in results
            ]
            filtered_results = filter_vector_results(vector_results, query_text, top_k)
            logger.info(
                "Atlas relevance gate kept %d/%d chunks for query",
                len(filtered_results),
                len(vector_results),
            )
            return filtered_results
        logger.warning("Atlas vectorSearch returned 0 results — falling back")
    except Exception as e:
        logger.warning("Atlas $vectorSearch failed: %s — falling back to keyword search", e)

    # Fallback must use the exact same tenant and document scope.
    filt = scope_filter

    # Keep embeddings in this bounded fallback projection. It allows the
    # service to remain semantically useful during an Atlas index outage while
    # retaining the exact tenant/document filter above.
    rows = list(col.find(filt, {"text": 1, "embedding": 1, "metadata": 1}))
    results = rank_rows(rows, query_embedding, query_text, top_k)
    logger.info("Hybrid fallback search returned %d chunks (filter=%s)", len(results), filt)
    return results
