from app.core import llm_router
from app.core.llm_telemetry import capture_llm_telemetry


class _Response:
    def raise_for_status(self):
        return None

    def json(self):
        return {"message": {"content": "local answer"}}


class _AsyncClient:
    calls = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def post(self, url, json):
        self.calls.append((url, json, self.kwargs))
        return _Response()


def _run_without_io(coroutine):
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    coroutine.close()
    raise AssertionError("mocked Ollama provider unexpectedly yielded for I/O")


def test_ollama_provider_uses_local_model_and_records_telemetry(monkeypatch):
    monkeypatch.setattr(llm_router.settings, "LLM_PROVIDER", "ollama", raising=False)
    monkeypatch.setattr(llm_router.settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434", raising=False)
    monkeypatch.setattr(llm_router.settings, "OLLAMA_MODEL", "qwen2.5-coder:3b", raising=False)
    monkeypatch.setattr(llm_router.httpx, "AsyncClient", _AsyncClient)
    _AsyncClient.calls = []

    with capture_llm_telemetry() as telemetry:
        result = _run_without_io(
            llm_router.call_llm(
                "Question",
                system_prompt="Answer from evidence",
                temperature=0.3,
                max_output_tokens=321,
            )
        )

    assert result == "local answer"
    url, payload, options = _AsyncClient.calls[0]
    assert url == "http://127.0.0.1:11434/api/chat"
    assert payload["model"] == "qwen2.5-coder:3b"
    assert payload["messages"] == [
        {"role": "system", "content": "Answer from evidence"},
        {"role": "user", "content": "Question"},
    ]
    assert payload["options"] == {"temperature": 0.3, "num_predict": 321}
    assert options["timeout"] > 0
    assert telemetry.attempts == [
        {"provider": "ollama", "model": "qwen2.5-coder:3b", "succeeded": True}
    ]


def test_ollama_status_is_reported_when_explicitly_selected(monkeypatch):
    monkeypatch.setattr(llm_router.settings, "LLM_PROVIDER", "ollama", raising=False)
    monkeypatch.setattr(llm_router.settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434", raising=False)
    monkeypatch.setattr(llm_router.settings, "OLLAMA_MODEL", "qwen2.5-coder:3b", raising=False)

    status = llm_router.get_llm_status()

    assert status["provider"] == "ollama"
    assert status["model"] == "qwen2.5-coder:3b"
    assert status["ollama_configured"] is True
