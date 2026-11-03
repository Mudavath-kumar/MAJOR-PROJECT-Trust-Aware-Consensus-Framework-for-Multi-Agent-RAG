import asyncio
from types import SimpleNamespace
import pytest

from app.core.llm_telemetry import capture_llm_telemetry, complete_llm_attempt, record_llm_attempt
from app.core import llm_router
from app.core.config import settings


def _run_without_io(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    coroutine.close()
    raise AssertionError("mocked provider coroutine unexpectedly yielded for I/O")


def test_capture_tracks_provider_attempts_and_success_state():
    with capture_llm_telemetry() as capture:
        gemini_attempt = record_llm_attempt("gemini", "gemini-test")
        complete_llm_attempt(gemini_attempt, succeeded=False)
        openrouter_attempt = record_llm_attempt("openrouter", "openrouter/test")
        complete_llm_attempt(openrouter_attempt, succeeded=True)

    assert capture.attempts == [
        {"provider": "gemini", "model": "gemini-test", "succeeded": False},
        {"provider": "openrouter", "model": "openrouter/test", "succeeded": True},
    ]


def test_attempts_outside_capture_are_ignored():
    assert record_llm_attempt("gemini", "gemini-test") is None


def test_llm_router_records_the_actual_successful_gemini_request(monkeypatch):
    class Models:
        async def generate_content(self, **_kwargs):
            return SimpleNamespace(text="verified response")

    client = SimpleNamespace(aio=SimpleNamespace(models=Models()))
    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(llm_router, "_get_client", lambda _key: client)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "AIza-unit-test-secret")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

    with capture_llm_telemetry() as capture:
        result = _run_without_io(llm_router.call_llm("prompt", model="gemini-test-model"))

    assert result == "verified response"
    assert capture.attempts == [
        {"provider": "gemini", "model": "gemini-test-model", "succeeded": True}
    ]
    assert "unit-test-secret" not in repr(capture.attempts)


def test_llm_router_records_provider_fallback_attempts(monkeypatch):
    class Models:
        async def generate_content(self, **_kwargs):
            raise RuntimeError("simulated provider failure")

    class OpenRouterResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "fallback response"}}]}

    class OpenRouterClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return OpenRouterResponse()

    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(
        llm_router,
        "_get_client",
        lambda _key: SimpleNamespace(aio=SimpleNamespace(models=Models())),
    )
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "AIza-unit-test-secret")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "unit-test-openrouter-secret")
    monkeypatch.setattr(settings, "OPENROUTER_MODEL", "openai/test-model")
    monkeypatch.setattr("httpx.AsyncClient", lambda **_kwargs: OpenRouterClient())

    with capture_llm_telemetry() as capture:
        result = _run_without_io(llm_router.call_llm("prompt", model="gemini-test-model"))

    assert result == "fallback response"
    assert capture.attempts == [
        {"provider": "gemini", "model": "gemini-test-model", "succeeded": False},
        {"provider": "gemini", "model": "gemini-3.5-flash-lite", "succeeded": False},
        {"provider": "openrouter", "model": "openai/test-model", "succeeded": True},
    ]
    assert "secret" not in repr(capture.attempts)


def test_llm_router_retries_gemini_once_after_transient_rate_limit(monkeypatch):
    class Models:
        attempts = 0

        async def generate_content(self, **_kwargs):
            self.attempts += 1
            if self.attempts == 1:
                error = RuntimeError("gateway timeout")
                error.code = 429
                raise error
            return SimpleNamespace(text="recovered response")

    models = Models()
    client = SimpleNamespace(aio=SimpleNamespace(models=models))

    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(llm_router, "_get_client", lambda _key: client)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "AIza-unit-test-secret")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

    result = asyncio.run(llm_router.call_llm("prompt", model="gemini-test-model"))

    assert result == "recovered response"
    assert models.attempts == 2


@pytest.mark.parametrize("status_code", [503, 504])
def test_llm_router_uses_flash_lite_when_primary_model_is_unavailable(monkeypatch, status_code):
    class Models:
        requested_models = []

        async def generate_content(self, *, model, **_kwargs):
            self.requested_models.append(model)
            if model == "gemini-3.8-flash":
                error = RuntimeError("model currently unavailable")
                error.code = status_code
                raise error
            return SimpleNamespace(text="fallback model response")

    models = Models()
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(llm_router, "_get_client", lambda _key: client)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "AIza-unit-test-secret")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")

    result = asyncio.run(llm_router.call_llm("prompt", model="gemini-3.8-flash"))

    assert result == "fallback model response"
    assert models.requested_models == ["gemini-3.8-flash", "gemini-3.5-flash-lite"]


def test_active_provider_prefers_configured_gemini_without_key_prefix_guess(monkeypatch):
    monkeypatch.setattr(llm_router, "_gemini_available", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "configured-google-key")
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "configured-openrouter-key")

    assert llm_router._get_active_provider() == "gemini"
