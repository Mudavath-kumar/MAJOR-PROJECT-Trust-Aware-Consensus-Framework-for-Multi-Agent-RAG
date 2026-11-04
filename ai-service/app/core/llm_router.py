import asyncio
import logging
from typing import Optional
import httpx
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


class LLMProvidersUnavailable(RuntimeError):
    """Raised when every configured LLM provider fails to produce a response."""


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
            http_options=genai_types.HttpOptions(timeout=30_000),  # 30s timeout to prevent premature 504 deadline expired
        )
        _client_key = api_key
    return _client


def _get_active_provider() -> str:
    selected_provider = settings.LLM_PROVIDER
    if selected_provider == "ollama":
        return "ollama" if settings.OLLAMA_BASE_URL else "unavailable"
    if selected_provider == "openrouter_free":
        return "openrouter_free" if settings.OPENROUTER_API_KEY else "unavailable"
    if selected_provider == "groq_free":
        return "groq_free" if settings.GROQ_API_KEY else "unavailable"
    if settings.GEMINI_API_KEY and _gemini_available:
        return "gemini"
    if settings.OPENROUTER_API_KEY:
        return "openrouter"
    return "unavailable"


async def _call_ollama(
    prompt: str,
    system_prompt: str,
    model: Optional[str],
    temperature: float,
    max_output_tokens: int,
    *,
    timeout_seconds: Optional[float] = None,
) -> str:
    if not settings.OLLAMA_BASE_URL:
        raise LLMProvidersUnavailable("Ollama is not configured for local fallback.")

    selected_model = settings.OLLAMA_MODEL or model or "qwen2.5-coder:3b"
    attempt = record_llm_attempt("ollama", selected_model)
    timeout = timeout_seconds or max(1.0, settings.OLLAMA_TIMEOUT_SECONDS)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": selected_model,
                    "stream": False,
                    "keep_alive": "10m",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_output_tokens,
                    },
                },
            )
            response.raise_for_status()
            content = response.json().get("message", {}).get("content", "")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Ollama returned an empty response")
        complete_llm_attempt(attempt, succeeded=True)
        return content
    except Exception as error:
        complete_llm_attempt(attempt, succeeded=False)
        logger.warning("Local Ollama request failed (model=%s): %s", selected_model, type(error).__name__)
        raise LLMProvidersUnavailable(
            f"Local Ollama provider failed for model {selected_model}."
        ) from error


async def call_llm(
    prompt: str,
    system_prompt: str = "You are an expert AI agent in the TrustRAG consensus framework.",
    model: Optional[str] = None,
    temperature: float = 0.2,
    api_key_override: Optional[str] = None,
    max_output_tokens: int = 1024,
) -> str:
    if settings.LLM_PROVIDER == "ollama":
        return await _call_ollama(
            prompt,
            system_prompt,
            model,
            temperature,
            max_output_tokens,
            timeout_seconds=max(1.0, settings.OLLAMA_TIMEOUT_SECONDS),
        )

    if settings.LLM_PROVIDER == "groq_free":
        if not settings.GROQ_API_KEY:
            raise LLMProvidersUnavailable(
                "Groq free mode is selected but GROQ_API_KEY is not configured."
            )
        selected_model = settings.GROQ_MODEL
        attempt = record_llm_attempt("groq", selected_model)
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                request_payload = {
                    "model": selected_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_output_tokens,
                }
                if selected_model.startswith("qwen/qwen3.8"):
                    request_payload["reasoning_effort"] = "none"

                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=request_payload,
                )
                # Do not retry 429s: Groq's free tier enforces account/model
                # limits and retrying can only add load to an exhausted quota.
                response.raise_for_status()
                content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
            if not isinstance(content, str) or not content.strip():
                raise RuntimeError("Groq returned an empty response")
            complete_llm_attempt(attempt, succeeded=True)
            return content
        except Exception as error:
            complete_llm_attempt(attempt, succeeded=False)
            failure_summary = _provider_error_summary("Groq", error)
            response = getattr(error, "response", None)
            retry_after = getattr(response, "headers", {}).get("retry-after")
            if _gemini_status_code(error) == 429 and retry_after and retry_after.isdigit():
                failure_summary += f"; retry after {retry_after} seconds"
            if _gemini_status_code(error) == 429 and settings.OLLAMA_BASE_URL:
                logger.warning("Groq rate limit reached; continuing with the configured local model")
                try:
                    return await _call_ollama(
                        prompt,
                        system_prompt,
                        model,
                        temperature,
                        max_output_tokens,
                        timeout_seconds=min(max(1.0, settings.OLLAMA_TIMEOUT_SECONDS), 45.0),
                    )
                except LLMProvidersUnavailable:
                    failure_summary += "; local Ollama fallback failed"
            logger.warning(
                "Groq free-tier request failed (model=%s): %s",
                selected_model,
                failure_summary,
            )
            raise LLMProvidersUnavailable(
                f"{failure_summary}; model={selected_model}; no paid provider was tried."
            ) from error

    key = api_key_override or settings.GEMINI_API_KEY
    chosen_model = model or settings.GEMINI_MODEL
    # Normalize legacy, deprecated (e.g. gemini-2.0, gemini-2.5) or invalid model names
    VALID_GEMINI_PREFIXES = ("gemini-3.5", "gemini-3.7", "gemini-3.8", "gemini-3.1")
    if not chosen_model or not any(chosen_model.startswith(p) for p in VALID_GEMINI_PREFIXES):
        logger.info("Non-standard model '%s' requested, normalizing to '%s'", chosen_model, settings.GEMINI_MODEL)
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
                    # If any error occurs on the primary model, fall back to fallback_model
                    if gemini_model != fallback_model:
                        logger.warning(
                            "Gemini model %s failed (%s); falling back to %s.",
                            gemini_model,
                            e,
                            fallback_model,
                        )
                        break
                    if attempt_number == 0 and _is_retryable_gemini_error(e):
                        status = _gemini_status_code(e)
                        sleep_seconds = 2.5 if status == 429 else 0.5
                        logger.warning(
                            "Gemini transient failure (model=%s, status=%s); backing off %.1fs before retry: %s",
                            gemini_model,
                            status,
                            sleep_seconds,
                            e,
                        )
                        await asyncio.sleep(sleep_seconds)
                        continue
                    logger.warning("Gemini failed (model=%s): %s", gemini_model, e)
                break
        return None

    async def _try_openrouter() -> Optional[str]:
        if not settings.OPENROUTER_API_KEY:
            return None
        if settings.LLM_PROVIDER == "openrouter_free" and not (
            settings.OPENROUTER_MODEL == "openrouter/free"
            or settings.OPENROUTER_MODEL.endswith(":free")
        ):
            raise LLMProvidersUnavailable(
                "Free-only OpenRouter mode requires model 'openrouter/free' or a model ID ending in ':free'."
            )
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
                        **(
                            {"reasoning": {"effort": "low"}}
                            if settings.LLM_PROVIDER == "openrouter_free"
                            else {}
                        ),
                    },
                )
                resp.raise_for_status()
                content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    complete_llm_attempt(attempt, succeeded=True)
                    return content
            complete_llm_attempt(attempt, succeeded=False)
            provider_failures.append("OpenRouter returned an empty response.")
        except Exception as e:
            complete_llm_attempt(attempt, succeeded=False)
            provider_failures.append(_provider_error_summary("OpenRouter", e))
            logger.warning("OpenRouter failed (model=%s): %s", settings.OPENROUTER_MODEL, e)
        return None

    # Explicit free-only mode must never fall through to Gemini or a paid
    # OpenRouter model, even when those credentials are also configured.
    if settings.LLM_PROVIDER == "openrouter_free":
        result = await _try_openrouter()
        if result:
            return result
        detail = "; ".join(dict.fromkeys(provider_failures)) or "No free OpenRouter model responded."
        raise LLMProvidersUnavailable(detail)

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

    # ── Final fallback: local Ollama ──────────────────────────────────────────
    # Reached when both Gemini (503/504) and OpenRouter (402 or other) have
    # failed.  Ollama runs entirely on the user's machine so it is immune to
    # cloud-provider outages and credit exhaustion.  We only skip it when
    # OLLAMA_BASE_URL is not set (i.e. the operator explicitly has no local
    # model server).
    if settings.OLLAMA_BASE_URL:
        logger.warning(
            "All cloud providers failed; falling back to local Ollama "
            "(model=%s). Cloud failures: %s",
            settings.OLLAMA_MODEL,
            "; ".join(dict.fromkeys(provider_failures)),
        )
        try:
            return await _call_ollama(
                prompt,
                system_prompt,
                model,
                temperature,
                max_output_tokens,
                timeout_seconds=max(1.0, settings.OLLAMA_TIMEOUT_SECONDS),
            )
        except LLMProvidersUnavailable as ollama_err:
            provider_failures.append(f"Ollama fallback: {ollama_err}")
            logger.error("Ollama fallback also failed: %s", ollama_err)
    # ─────────────────────────────────────────────────────────────────────────

    failure_details = "; ".join(dict.fromkeys(provider_failures))
    if not failure_details:
        failure_details = "No configured provider was available."
    raise LLMProvidersUnavailable(f"No LLM provider responded. {failure_details}")


def get_llm_status() -> dict:
    """Returns active LLM provider status for health check."""
    provider = _get_active_provider()
    selected_model = (
        settings.OLLAMA_MODEL if provider == "ollama" else
        settings.GROQ_MODEL if provider == "groq_free" else
        settings.OPENROUTER_MODEL if provider == "openrouter_free" else
        settings.GEMINI_MODEL if provider == "gemini" else
        settings.OPENROUTER_MODEL if provider == "openrouter" else None
    )
    return {
        "provider": provider,
        "model": selected_model,
        "gemini_configured": bool(settings.GEMINI_API_KEY and _gemini_available),
        "openrouter_configured": bool(settings.OPENROUTER_API_KEY),
        "ollama_configured": bool(settings.OLLAMA_BASE_URL),
        "groq_configured": bool(settings.GROQ_API_KEY),
        "free_tier": True,
    }
