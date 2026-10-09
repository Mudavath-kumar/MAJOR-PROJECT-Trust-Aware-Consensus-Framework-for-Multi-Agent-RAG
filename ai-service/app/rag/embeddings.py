import logging
import math
from typing import List
from ..core.config import settings

logger = logging.getLogger("trustrag.embeddings")
EMBEDDING_BATCH_SIZE = 32
EMBEDDING_DIMENSIONALITY = 384

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

    results: List[List[float]] = []
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.EMBEDDING_MODEL_NAME}:batchEmbedContents"
    )
    headers = {"x-goog-api-key": api_key}
    try:
        import httpx

        for start in range(0, len(texts), EMBEDDING_BATCH_SIZE):
            batch = texts[start : start + EMBEDDING_BATCH_SIZE]
            resp = httpx.post(
                endpoint,
                headers=headers,
                json={"requests": [
                    {
                        "model": f"models/{settings.EMBEDDING_MODEL_NAME}",
                        "content": {"parts": [{"text": text}]},
                        "embedContentConfig": {
                            "outputDimensionality": EMBEDDING_DIMENSIONALITY,
                            "autoTruncate": False,
                        },
                    }
                    for text in batch
                ]},
                timeout=15.0,
            )
            resp.raise_for_status()
            batch_embeddings = resp.json().get("embeddings")
            if not isinstance(batch_embeddings, list) or len(batch_embeddings) != len(batch):
                raise RuntimeError("Gemini embedding service returned an incomplete batch")
            for item in batch_embeddings:
                values = item.get("values") if isinstance(item, dict) else None
                if (
                    not isinstance(values, list)
                    or len(values) != EMBEDDING_DIMENSIONALITY
                    or any(
                        isinstance(value, bool)
                        or not isinstance(value, (int, float))
                        or not math.isfinite(value)
                        for value in values
                    )
                ):
                    raise RuntimeError(
                        f"Gemini embedding service returned a vector that is not expected "
                        f"{EMBEDDING_DIMENSIONALITY}-dimensional numeric data"
                    )
                results.append([float(value) for value in values])
    except Exception as e:
        status_code = getattr(getattr(e, "response", None), "status_code", None)
        if status_code is not None:
            logger.error("Gemini embedding API request failed with HTTP %s", status_code)
            raise RuntimeError(
                f"Gemini embedding service rejected the request (HTTP {status_code})"
            ) from e

        logger.error("Gemini embedding API failed (%s)", type(e).__name__)
        if isinstance(e, RuntimeError) and str(e).startswith("Gemini embedding service returned"):
            raise
        raise RuntimeError("Gemini embedding service is unavailable") from e
    return results
