import math
import re
from typing import Any, Dict, Iterable, List


STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
}

BROAD_QUERY_TERMS = {
    "all",
    "document",
    "documents",
    "everything",
    "findings",
    "important",
    "key",
    "main",
    "overview",
    "summarise",
    "summarize",
    "summary",
}


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9][a-z0-9_-]{1,}", value.lower())
        if token not in STOP_WORDS
    }


def lexical_relevance(query: str, text: str) -> float:
    query_terms = _tokens(query)
    if not query_terms:
        return 0.0
    text_terms = _tokens(text)
    overlap = len(query_terms & text_terms) / len(query_terms)
    normalized_query = " ".join(sorted(query_terms))
    normalized_text = " ".join(sorted(text_terms))
    phrase_bonus = 0.15 if normalized_query and normalized_query in normalized_text else 0.0
    return min(1.0, overlap + phrase_bonus)


def cosine_similarity(left: Iterable[float], right: Iterable[float]) -> float:
    left_values = list(left)
    right_values = list(right)
    if not left_values or len(left_values) != len(right_values):
        return 0.0
    dot = sum(a * b for a, b in zip(left_values, right_values))
    left_norm = math.sqrt(sum(value * value for value in left_values))
    right_norm = math.sqrt(sum(value * value for value in right_values))
    if not left_norm or not right_norm:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def filter_vector_results(
    results: List[Dict[str, Any]], query_text: str, top_k: int
) -> List[Dict[str, Any]]:
    """Reject high-baseline vector matches that have no query evidence.

    Atlas can return a top-K result even when every candidate is irrelevant.
    Broad summary prompts intentionally keep those candidates; specific
    questions require either lexical support or a genuinely strong vector hit.
    """
    query_terms = _tokens(query_text)
    if not query_terms or not (query_terms - BROAD_QUERY_TERMS):
        return results[:top_k]

    filtered: list[tuple[float, Dict[str, Any]]] = []
    for result in results:
        metadata = result.get("metadata") or {}
        searchable = f"{result.get('text', '')} {metadata.get('document_name', '')}"
        lexical = lexical_relevance(query_text, searchable)
        semantic = float(result.get("similarity_score", 0.0))
        if lexical <= 0.0 and semantic < 0.88:
            continue
        filtered.append((semantic + min(0.1, lexical * 0.1), result))

    filtered.sort(key=lambda item: item[0], reverse=True)
    return [result for _, result in filtered[:top_k]]


def rank_rows(
    rows: List[Dict[str, Any]],
    query_embedding: List[float],
    query_text: str,
    top_k: int,
) -> List[Dict[str, Any]]:
    ranked: list[tuple[float, Dict[str, Any]]] = []
    for row in rows:
        semantic = cosine_similarity(query_embedding, row.get("embedding") or [])
        lexical = lexical_relevance(query_text, str(row.get("text", "")))
        score = max(semantic, lexical) if semantic or lexical else 0.0
        if score <= 0.0:
            continue
        ranked.append((score, row))

    ranked.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "chunk_id": str(row["_id"]),
            "text": row.get("text", ""),
            "metadata": row.get("metadata", {}),
            "similarity_score": round(float(score), 4),
        }
        for score, row in ranked[:top_k]
    ]
