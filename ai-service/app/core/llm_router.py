import logging
from typing import Optional
from .config import settings

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


def _get_client(api_key: str):
    global _client, _client_key
    if _client is None or _client_key != api_key:
        _client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(timeout=15_000),  # ms — fail over quickly
        )
        _client_key = api_key
    return _client


def _get_active_provider() -> str:
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.startswith("AIza") and _gemini_available:
        return "gemini"
    if settings.OPENROUTER_API_KEY:
        return "openrouter"
    if settings.GEMINI_API_KEY and _gemini_available:
        return "gemini"
    return "unavailable"


async def call_llm(
    prompt: str,
    system_prompt: str = "You are an expert AI agent in the TrustRAG consensus framework.",
    model: Optional[str] = None,
    temperature: float = 0.2,
    api_key_override: Optional[str] = None,
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

    prefer_gemini = bool(key and key.startswith("AIza") and _gemini_available)

    async def _try_gemini() -> Optional[str]:
        if not (key and _gemini_available):
            return None
        try:
            client = _get_client(key)
            response = await client.aio.models.generate_content(
                model=chosen_model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    max_output_tokens=2048,
                ),
            )
            if response and response.text:
                return response.text
            logger.warning("Gemini returned an empty response.")
        except Exception as e:
            logger.warning("Gemini failed (model=%s): %s", chosen_model, e)
        return None

    async def _try_openrouter() -> Optional[str]:
        if not settings.OPENROUTER_API_KEY:
            return None
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
                        "max_tokens": 2048,
                    },
                )
                resp.raise_for_status()
                content = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    return content
        except Exception as e:
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

    # ── 3. Ollama Local Fallback (runs offline) ──────────────────────────────
    try:
        import httpx

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_ENDPOINT}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": f"{system_prompt}\n\n{prompt}",
                    "stream": False,
                    "options": {"temperature": temperature},
                },
            )
            if resp.status_code == 200:
                return resp.json().get("response", "")
    except Exception as e:
        logger.warning("Ollama failed (endpoint=%s model=%s): %s", settings.OLLAMA_ENDPOINT, settings.OLLAMA_MODEL, e)

    raise RuntimeError(
        f"No LLM provider responded. "
        f"Gemini model tried: {chosen_model} | "
        f"OpenRouter configured: {bool(settings.OPENROUTER_API_KEY)} | "
        f"Ollama endpoint: {settings.OLLAMA_ENDPOINT}. "
        "Check the WARNING logs above for the specific failure."
    )


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
        "ollama_endpoint": settings.OLLAMA_ENDPOINT,
        "free_tier": True,
    }
