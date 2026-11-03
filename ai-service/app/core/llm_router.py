import asyncio
import logging
from typing import Optional
from .config import settings
from .llm_telemetry import complete_llm_attempt, record_llm_attempt

logger = logging.getLogger("trustrag.llm")

# ── Provider: Google Gemini (free tier) via the supported google-genai SDK ──
# The legacy `google.generativeai` package is deprecated (all support ended) and
# hangs when `system_instruction` is set, so we use the modern `google.genai` SDK.
try:
    from google import genai
    from google.genai import types as genai_types

    _gemini_available = True
except ImportError:
    _gemini_available = False
    logger.warning("google-genai not installed. Run: pip install google-genai")

_client = None
_client_key = ""
_GEMINI_RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def _gemini_status_code(error: Exception) -> Optional[int]:
    response = getattr(error, "response", None)
    for value in (
        getattr(error, "status_code", None),
        getattr(error, "code", None),
        getattr(response, "status_code", None),
    ):
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _is_retryable_gemini_error(error: Exception) -> bool:
    return isinstance(error, (TimeoutError, asyncio.TimeoutError)) or (
        _gemini_status_code(error) in _GEMINI_RETRYABLE_STATUS_CODES
    )


def _provider_error_summary(provider: str, error: Exception) -> str:
    response = getattr(error, "response", None)
    status_code = _gemini_status_code(error) or getattr(response, "status_code", None)
    labels = {
        402: "payment or credit limit required",
        401: "authentication rejected",
        403: "permission denied",
        429: "rate limit reached",
        503: "provider is overloaded or unavailable",
        504: "provider deadline expired",
    }
    try:
        status_code = int(status_code) if status_code is not None else None
    except (TypeError, ValueError):
        status_code = None
    if status_code is not None:
        detail = labels.get(status_code, "request rejected")
        return f"{provider} HTTP {status_code}: {detail}"
    if isinstance(error, (TimeoutError, asyncio.TimeoutError)):
        return f"{provider} request timed out"
    return f"{provider} request failed ({type(error).__name__})"


def _get_client(api_key: str):
    global _client, _client_key
    if _client is None or _client_key != api_key:
        _client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(timeout=10_000),  # ms — bound failover latency
        )
        _client_key = api_key
    return _client


def _get_active_provider() -> str:
    if settings.GEMINI_API_KEY and _gemini_available:
        return "gemini"
    if settings.OPENROUTER_API_KEY:
        return "openrouter"
    return "unavailable"


async def call_llm(
    prompt: str,
    system_prompt: str = "You are an expert AI agent in the TrustRAG consensus framework.",
    model: Optional[str] = None,
    temperature: float = 0.2,
    api_key_override: Optional[str] = None,
    max_output_tokens: int = 1024,
) -> str:
    key = api_key_override or settings.GEMINI_API_KEY
    chosen_model = model or settings.GEMINI_MODEL
    # Normalize legacy/non-gemini model names to the configured Gemini model
    if chosen_model and not chosen_model.startswith("gemini"):
        logger.debug("Non-Gemini model '%s' requested, using configured model '%s'", chosen_model, settings.GEMINI_MODEL)
        chosen_model = settings.GEMINI_MODEL
    # Strip the -latest suffix which causes 404 on the Gemini API
    if chosen_model.endswith("-latest"):
        chosen_model = chosen_model[:-len("-latest")]

    # A key prefix is not a reliable provider-validity check. The SDK handles
    # invalid credentials explicitly; when configured, Gemini should be tried
    # before a paid OpenRouter route.
    prefer_gemini = bool(key and _gemini_available)
    provider_failures = []

    async def _try_gemini() -> Optional[str]:
        if not (key and _gemini_available):
            return None
        client = _get_client(key)
        fallback_model = "gemini-3.5-flash-lite"
        models_to_try = [chosen_model]
        if chosen_model != fallback_model:
            models_to_try.append(fallback_model)

        for gemini_model in models_to_try:
            for attempt_number in range(2):
                attempt = record_llm_attempt("gemini", gemini_model)
                try:
                    response = await client.aio.models.generate_content(
                        model=gemini_model,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            temperature=temperature,
                            max_output_tokens=max_output_tokens,
                        ),
                    )
                    if response and response.text:
                        complete_llm_attempt(attempt, succeeded=True)
                        return response.text
                    logger.warning("Gemini returned an empty response (model=%s).", gemini_model)
                    complete_llm_attempt(attempt, succeeded=False)
                except Exception as e:
                    complete_llm_attempt(attempt, succeeded=False)
                    provider_failures.append(_provider_error_summary("Gemini", e))
                    status_code = _gemini_status_code(e)
                    if status_code in {503, 504} and gemini_model != fallback_model:
                        logger.warning(
                            "Gemini model %s returned HTTP %s; falling back to %s.",
                            gemini_model,
                            status_code,
                            fallback_model,
                        )
                        break
                    if attempt_number == 0 and _is_retryable_gemini_error(e):
                        logger.warning(
                            "Gemini transient failure (model=%s); retrying once: %s",
                            gemini_model,
                            e,
                        )
                        await asyncio.sleep(0.5)
                        continue
                    logger.warning("Gemini failed (model=%s): %s", gemini_model, e)
                break
        return None

    async def _try_openrouter() -> Optional[str]:
        if not settings.OPENROUTER_API_KEY:
            return None
        attempt = record_llm_attempt("openrouter", settings.OPENROUTER_MODEL)
        try:
            import httpx
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "X-Title": settings.OPENROUTER_APP_NAME,
            }
            if settings.OPENROUTER_SITE_URL:
                headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": temperature,
                        "max_tokens": max_output_tokens,
                    },
                )
                resp.raise_for_status()
                content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    complete_llm_attempt(attempt, succeeded=True)
                    return content
            complete_llm_attempt(attempt, succeeded=False)
        except Exception as e:
            complete_llm_attempt(attempt, succeeded=False)
            provider_failures.append(_provider_error_summary("OpenRouter", e))
            logger.warning("OpenRouter failed (model=%s): %s", settings.OPENROUTER_MODEL, e)
        return None

    # Try preferred provider first
    if prefer_gemini:
        res = await _try_gemini()
        if res:
            return res
        res = await _try_openrouter()
        if res:
            return res
    else:
        # If Gemini key is not an official AIza key, use OpenRouter first to avoid 404/403 lag
        res = await _try_openrouter()
        if res:
            return res
        res = await _try_gemini()
        if res:
            return res

    failure_details = "; ".join(dict.fromkeys(provider_failures))
    if not failure_details:
        failure_details = "No configured provider was available."
    raise RuntimeError(f"No LLM provider responded. {failure_details}")


def get_llm_status() -> dict:
    """Returns active LLM provider status for health check."""
    provider = _get_active_provider()
    return {
        "provider": provider,
        "model": settings.GEMINI_MODEL if provider == "gemini" else (
            settings.OPENROUTER_MODEL if provider == "openrouter" else None
        ),
        "gemini_configured": bool(settings.GEMINI_API_KEY and _gemini_available),
        "openrouter_configured": bool(settings.OPENROUTER_API_KEY),
        "free_tier": True,
    }
