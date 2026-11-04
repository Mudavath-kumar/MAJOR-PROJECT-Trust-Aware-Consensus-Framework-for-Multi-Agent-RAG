from types import SimpleNamespace

import httpx
import pytest

from app.core import llm_router
from app.core.config import settings


def _run_without_io(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    coroutine.close()
    raise AssertionError("mocked provider coroutine unexpectedly yielded for I/O")


def test_exhausted_provider_failures_have_a_specific_exception_type(monkeypatch):
    class Models:
        async def generate_content(self, **kwargs):
            error = RuntimeError("provider temporarily unavailable")
            error.code = 503 if kwargs["model"] == "gemini-test-model" else 401
            raise error

    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(
        llm_router,
        "_get_client",
        lambda _key: SimpleNamespace(aio=SimpleNamespace(models=Models())),
    )
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-gemini-key")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

    with pytest.raises(RuntimeError) as raised:
        _run_without_io(llm_router.call_llm("prompt", model="gemini-test-model"))

    assert type(raised.value).__name__ == "LLMProvidersUnavailable"


def test_openrouter_free_mode_never_uses_paid_model_or_gemini(monkeypatch):
    calls = []

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "free response"}}]}

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, *, headers, json):
            calls.append(json["model"])
            return Response()

    monkeypatch.setattr(settings, "LLM_PROVIDER", "openrouter_free")
    monkeypatch.setattr(settings, "OPENROUTER_MODEL", "openrouter/free")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "configured-but-must-not-run")
    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(llm_router.httpx, "AsyncClient", Client)

    result = _run_without_io(llm_router.call_llm("prompt"))

    assert result == "free response"
    assert calls == ["openrouter/free"]


def test_openrouter_free_mode_rejects_paid_model_id(monkeypatch):
    monkeypatch.setattr(settings, "LLM_PROVIDER", "openrouter_free")
    monkeypatch.setattr(settings, "OPENROUTER_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-key")

    with pytest.raises(RuntimeError, match="requires model"):
        _run_without_io(llm_router.call_llm("prompt"))


def test_groq_free_mode_uses_only_groq_and_returns_response(monkeypatch):
    calls = []

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "Groq answer"}}]}

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, json):
            calls.append((url, json["model"]))
            return Response()

    monkeypatch.setattr(settings, "LLM_PROVIDER", "groq_free")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "openai/gpt-oss-20b")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "must-not-be-used")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "must-not-be-used")
    monkeypatch.setattr(llm_router.httpx, "AsyncClient", Client)

    result = _run_without_io(llm_router.call_llm("prompt"))

    assert result == "Groq answer"
    assert calls == [("https://api.groq.com/openai/v1/chat/completions", "openai/gpt-oss-20b")]


def test_groq_free_mode_exposes_rate_limit_status_without_fallback(monkeypatch):
    response = httpx.Response(
        429,
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        headers={"retry-after": "7"},
    )
    calls = []

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, json):
            calls.append(url)
            return response

    monkeypatch.setattr(settings, "LLM_PROVIDER", "groq_free")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "qwen/qwen3.8-27b")
    monkeypatch.setattr(settings, "OLLAMA_BASE_URL", "")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "must-not-be-used")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "must-not-be-used")
    monkeypatch.setattr(llm_router.httpx, "AsyncClient", Client)

    with pytest.raises(RuntimeError, match="Groq HTTP 429: rate limit reached") as raised:
        _run_without_io(llm_router.call_llm("prompt"))

    assert "retry after 7 seconds" in str(raised.value)
    assert "no paid provider was tried" in str(raised.value)
    assert calls == ["https://api.groq.com/openai/v1/chat/completions"]


def test_groq_rate_limit_falls_back_to_local_ollama_only(monkeypatch):
    groq_response = httpx.Response(
        429,
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
        headers={"retry-after": "7"},
    )
    ollama_response = httpx.Response(
        200,
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/chat"),
        json={"message": {"content": "Local grounded draft"}},
    )
    responses = [groq_response, ollama_response]
    calls = []

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers=None, json):
            calls.append((url, json))
            return responses.pop(0)

    monkeypatch.setattr(settings, "LLM_PROVIDER", "groq_free")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "qwen/qwen3.8-27b")
    monkeypatch.setattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    monkeypatch.setattr(settings, "OLLAMA_MODEL", "qwen2.5-coder:3b")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "must-not-be-used")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "must-not-be-used")
    monkeypatch.setattr(llm_router.httpx, "AsyncClient", Client)

    result = _run_without_io(llm_router.call_llm("Evidence-backed question"))

    assert result == "Local grounded draft"
    assert [url for url, _ in calls] == [
        "https://api.groq.com/openai/v1/chat/completions",
        "http://127.0.0.1:11434/api/chat",
    ]
    assert calls[0][1]["reasoning_effort"] == "none"
    assert calls[1][1]["model"] == "qwen2.5-coder:3b"
    assert calls[1][1]["keep_alive"] == "10m"


def test_qwen_groq_request_disables_hidden_reasoning_for_short_rag_tasks(monkeypatch):
    payloads = []

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "claims"}}]}

    class Client:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, *, headers, json):
            payloads.append(json)
            return Response()

    monkeypatch.setattr(settings, "LLM_PROVIDER", "groq_free")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "unit-test-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "qwen/qwen3.8-27b")
    monkeypatch.setattr(settings, "OLLAMA_BASE_URL", "")
    monkeypatch.setattr(llm_router.httpx, "AsyncClient", Client)

    assert _run_without_io(llm_router.call_llm("prompt")) == "claims"
    assert payloads[0]["reasoning_effort"] == "none"
