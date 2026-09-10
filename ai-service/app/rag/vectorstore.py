import os
import logging
from typing import List, Dict, Any, Optional
from ..core.config import settings

logger = logging.getLogger("trustrag.vectorstore")

_client = None
_collection = None


def get_chroma_collection():
    global _client, _collection
    if _collection is None:
        try:
            import chromadb
            os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
            _client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            _collection = _client.get_or_create_collection(
                name="trustrag_documents",
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("ChromaDB initialized at %s", settings.CHROMA_PERSIST_DIR)
        except Exception as e:
            raise RuntimeError(f"ChromaDB initialization failed: {e}") from e
    return _collection


def _build_where(
    document_id: Optional[str] = None,
    user_id: Optional[str] = None,
    document_ids: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """Build a valid ChromaDB where clause. Returns None if no filters — caller must guard."""
    clauses: List[Dict[str, Any]] = []
    if user_id:
        clauses.append({"user_id": {"$eq": user_id}})
    if document_id:
        clauses.append({"document_id": {"$eq": document_id}})
    if document_ids and len(document_ids) == 1:
        clauses.append({"document_id": {"$eq": document_ids[0]}})
    elif document_ids and len(document_ids) > 1:
        clauses.append({"document_id": {"$in": document_ids}})
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def add_document_chunks(
    chunk_ids: List[str],
    embeddings: List[List[float]],
    documents: List[str],
    metadatas: List[Dict[str, Any]],
) -> None:
    coll = get_chroma_collection()
    coll.add(ids=chunk_ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def delete_document_chunks(document_id: str, user_id: Optional[str] = None) -> int:
    """Delete all vectors for one document. Returns count deleted."""
    coll = get_chroma_collection()
    where_filter = _build_where(document_id=document_id, user_id=user_id)
    if where_filter is None:
        logger.error("delete_document_chunks: no filters provided — aborting to prevent full wipe")
        return 0
    matches = coll.get(where=where_filter, include=[])
    ids = matches.get("ids", []) if matches else []
    if ids:
        coll.delete(ids=ids)
    return len(ids)


def get_document_chunks(document_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return indexed chunks for an owned document."""
    coll = get_chroma_collection()
    where_filter = _build_where(document_id=document_id, user_id=user_id)
    if where_filter is None:
        return []
    result = coll.get(where=where_filter, include=["documents", "metadatas"])
    ids = result.get("ids", []) if result else []
    docs = result.get("documents", []) if result else []
    metas = result.get("metadatas", []) if result else []
    return [
        {
            "chunk_id": ids[i],
            "text": docs[i] if i < len(docs) else "",
            "metadata": metas[i] if i < len(metas) else {},
        }
        for i in range(len(ids))
    ]


def query_vector_store(
    query_embedding: List[float],
    top_k: int = 5,
    document_ids: Optional[List[str]] = None,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    coll = get_chroma_collection()
    where_filter = _build_where(user_id=user_id, document_ids=document_ids)

    # Safety: never query without a filter (cross-user data leak)
    if where_filter is None:
        logger.warning("query_vector_store: no user_id or document_ids — returning empty (data leak prevention)")
        return []

    # Guard: n_results must not exceed collection size
    try:
        total = coll.count()
    except Exception:
        total = top_k
    safe_k = min(top_k, max(1, total))

    results = coll.query(
        query_embeddings=[query_embedding],
        n_results=safe_k,
        where=where_filter,
    )

    hits: List[Dict[str, Any]] = []
    if results and results.get("documents") and len(results["documents"][0]) > 0:
        for i in range(len(results["documents"][0])):
            dist = results["distances"][0][i] if "distances" in results else 0.1
            hits.append({
                "chunk_id": results["ids"][0][i],
                "text": results["documents"][0][i],
                "metadata": (results.get("metadatas") or [[]])[0][i] if results.get("metadatas") else {},
                "similarity_score": round(max(0.0, 1.0 - dist), 4),
            })
    return hits
