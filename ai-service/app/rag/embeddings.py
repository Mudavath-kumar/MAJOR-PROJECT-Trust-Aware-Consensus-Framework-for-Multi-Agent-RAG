import logging
import math
import time
from typing import List
from ..core.config import settings

logger = logging.getLogger("trustrag.embeddings")
EMBEDDING_BATCH_SIZE = 32
EMBEDDING_DIMENSIONALITY = 384
EMBEDDING_RETRYABLE_STATUSES = {429, 503}
EMBEDDING_MAX_RETRIES = 2


def _retry_delay(response, retry_index: int) -> float:
    retry_after = response.headers.get("Retry-After") if response is not None else None
    try:
        return min(30.0, max(0.0, float(retry_after)))
    except (TypeError, ValueError):
        return float(2**retry_index)


def _provider_error_summary(response, api_key: str) -> str:
    status_code = getattr(response, "status_code", None)
    detail = f"HTTP {status_code}" if status_code is not None else "provider error"
    try:
        error = response.json().get("error", {})
    except (AttributeError, TypeError, ValueError):
        error = {}
    if isinstance(error, dict):
        provider_status = error.get("status") or error.get("code")
        message = error.get("message")
        if provider_status:
            detail += f" {provider_status}"
        if isinstance(message, str) and message.strip():
            detail += f": {message.strip()[:240]}"
    if api_key:
        detail = detail.replace(api_key, "[redacted]")
    return detail


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
            payload = {"requests": [
                {
                    "model": f"models/{settings.EMBEDDING_MODEL_NAME}",
                    "content": {"parts": [{"text": text}]},
                    "embedContentConfig": {
                        "outputDimensionality": EMBEDDING_DIMENSIONALITY,
                        "autoTruncate": False,
                    },
                }
                for text in batch
            ]}
            for retry_index in range(EMBEDDING_MAX_RETRIES + 1):
                try:
                    resp = httpx.post(endpoint, headers=headers, json=payload, timeout=15.0)
                    resp.raise_for_status()
                    break
                except httpx.HTTPStatusError as exc:
                    status_code = exc.response.status_code
                    if status_code not in EMBEDDING_RETRYABLE_STATUSES or retry_index >= EMBEDDING_MAX_RETRIES:
                        raise
                    delay = _retry_delay(exc.response, retry_index)
                    logger.warning(
                        "Gemini embedding service returned HTTP %s; retrying batch after %.1f seconds (attempt %s/%s).",
                        status_code,
                        delay,
                        retry_index + 1,
                        EMBEDDING_MAX_RETRIES,
                    )
                    time.sleep(delay)
                except httpx.TransportError as exc:
                    if retry_index >= EMBEDDING_MAX_RETRIES:
                        raise
                    delay = float(2**retry_index)
                    logger.warning(
                        "Gemini embedding transport failed (%s); retrying batch after %.1f seconds (attempt %s/%s).",
                        type(exc).__name__,
                        delay,
                        retry_index + 1,
                        EMBEDDING_MAX_RETRIES,
                    )
                    time.sleep(delay)
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
            detail = _provider_error_summary(e.response, api_key)
            logger.error("Gemini embedding API request failed: %s", detail)
            raise RuntimeError(
                f"Gemini embedding service rejected the request ({detail})"
            ) from e

        logger.error("Gemini embedding API failed (%s)", type(e).__name__)
        if isinstance(e, RuntimeError) and str(e).startswith("Gemini embedding service returned"):
            raise
        raise RuntimeError(f"Gemini embedding service is unavailable ({type(e).__name__})") from e
    return results
