import logging
import time
from typing import List
from ..core.config import settings

logger = logging.getLogger("trustrag.embeddings")

_ready = False


def is_embedding_model_ready() -> bool:
    # Always ready: Gemini API is used if key available, sparse fallback otherwise
    return True


def get_embedding_model():
    # No local model to load — embeddings are computed via Gemini API
    return None


def compute_embeddings(texts: List[str]) -> List[List[float]]:
    """Compute embeddings using Google Gemini text-embedding-004 API.
    Output dimension fixed at 384 to match the Atlas vector search index.
    Falls back to TF-IDF sparse vectors if API is unavailable.
    """
    if not texts:
        return []

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — using sparse fallback embeddings")
        return _sparse_fallback(texts)

    try:
        import httpx
        results = []
        # Gemini embedding API processes one text at a time
        for text in texts:
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}",
                json={
                    "model": "models/text-embedding-004",
                    "content": {"parts": [{"text": text[:2048]}]},
                    "outputDimensionality": 384,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            values = resp.json()["embedding"]["values"]
            results.append(values)
            # Respect free tier rate limit (1500 req/min = 25/sec)
            if len(texts) > 1:
                time.sleep(0.05)
        return results
    except Exception as e:
        logger.warning("Gemini embedding API failed: %s — using sparse fallback", e)
        return _sparse_fallback(texts)


def _sparse_fallback(texts: List[str]) -> List[List[float]]:
    """Simple TF-IDF-style sparse vector as fallback (384 dims)."""
    import hashlib
    import math
    DIM = 384
    results = []
    for text in texts:
        vec = [0.0] * DIM
        words = text.lower().split()
        for word in words:
            idx = int(hashlib.md5(word.encode()).hexdigest(), 16) % DIM
            vec[idx] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        results.append([v / norm for v in vec])
    return results
