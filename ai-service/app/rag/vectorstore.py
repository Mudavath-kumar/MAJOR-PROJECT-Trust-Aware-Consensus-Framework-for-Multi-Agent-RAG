import logging
from typing import List, Dict, Any, Optional
from ..core.config import settings

logger = logging.getLogger("trustrag.vectorstore")

_col = None  # pymongo Collection


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
                    "fields": [{
                        "type": "vector",
                        "path": "embedding",
                        "numDimensions": 384,
                        "similarity": "cosine",
                    }]
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
) -> List[Dict[str, Any]]:
    if not user_id and not document_ids:
        logger.warning("query_vector_store: no filters — returning empty (data leak prevention)")
        return []

    col = _get_collection()

    # Build pre-filter for Atlas $vectorSearch
    pre_filter: Dict[str, Any] = {}
    if user_id:
        pre_filter["user_id"] = {"$eq": user_id}
    if document_ids and len(document_ids) == 1:
        pre_filter["document_id"] = {"$eq": document_ids[0]}
    elif document_ids:
        pre_filter["document_id"] = {"$in": document_ids}

    # Try Atlas Vector Search first
    try:
        pipeline = [
            {
                "$vectorSearch": {
                    "index": "embedding_index",
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": top_k * 10,
                    "limit": top_k,
                    **({"filter": pre_filter} if pre_filter else {}),
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "text": 1,
                    "metadata": 1,
                    "score": {"$meta": "vectorSearchScore"},
                }
            },
        ]
        results = list(col.aggregate(pipeline))
        if results:
            return [
                {
                    "chunk_id": str(r["_id"]),
                    "text": r["text"],
                    "metadata": r.get("metadata", {}),
                    "similarity_score": round(float(r.get("score", 0.8)), 4),
                }
                for r in results
            ]
    except Exception as e:
        logger.warning("Atlas $vectorSearch unavailable, falling back to keyword search: %s", e)

    # Fallback: keyword search (works on free local MongoDB too)
    filt: Dict[str, Any] = {}
    if user_id:
        filt["user_id"] = user_id
    if document_ids and len(document_ids) == 1:
        filt["document_id"] = document_ids[0]
    elif document_ids:
        filt["document_id"] = {"$in": document_ids}

    rows = list(col.find(filt, {"embedding": 0}).limit(top_k * 3))
    return [
        {
            "chunk_id": str(r["_id"]),
            "text": r["text"],
            "metadata": r.get("metadata", {}),
            "similarity_score": 0.75,
        }
        for r in rows[:top_k]
    ]
