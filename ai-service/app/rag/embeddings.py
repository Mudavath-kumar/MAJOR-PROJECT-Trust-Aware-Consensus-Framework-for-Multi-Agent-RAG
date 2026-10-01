import logging
from typing import List
from ..core.config import settings

logger = logging.getLogger("trustrag.embeddings")

def is_embedding_model_ready() -> bool:
    """Report configuration readiness without pretending a local fallback exists."""
    return bool(settings.GEMINI_API_KEY)


def get_embedding_model():
    # No local model to load — embeddings are computed via Gemini API
    return None


def compute_embeddings(texts: List[str]) -> List[List[float]]:
    """Compute embeddings using the configured Gemini embedding endpoint."""
    if not texts:
        return []

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for document embeddings")

    try:
        import httpx
        results = []
        # Gemini embedding API processes one text at a time
        for text in texts:
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{settings.EMBEDDING_MODEL_NAME}:embedContent?key={api_key}",
                json={
                    "model": f"models/{settings.EMBEDDING_MODEL_NAME}",
                    "content": {"parts": [{"text": text[:2048]}]},
                    "outputDimensionality": 384,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            values = resp.json()["embedding"]["values"]
            results.append(values)
        return results
    except Exception as e:
        logger.error("Gemini embedding API failed: %s", e)
        raise RuntimeError("Gemini embedding service is unavailable") from e
