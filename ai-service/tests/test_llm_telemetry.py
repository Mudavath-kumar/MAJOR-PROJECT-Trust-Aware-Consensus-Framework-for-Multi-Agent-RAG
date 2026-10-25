from types import SimpleNamespace

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
        {"provider": "openrouter", "model": "openai/test-model", "succeeded": True},
    ]
    assert "secret" not in repr(capture.attempts)
