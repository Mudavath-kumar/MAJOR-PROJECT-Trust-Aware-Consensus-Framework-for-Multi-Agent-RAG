import pytest

from app.core.config import settings
from app.rag import embeddings


class FakeResponse:
    def __init__(self, count, *, bad_dimension=False):
        dimension = 383 if bad_dimension else 384
        self.payload = {"embeddings": [{"values": [float(index)] * dimension} for index in range(count)]}

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_compute_embeddings_batches_full_text_and_keeps_api_key_out_of_url(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-secret")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    requests = []

    def post(url, *, headers, json, timeout):
        requests.append((url, headers, json, timeout))
        return FakeResponse(len(json["requests"]))

    monkeypatch.setattr("httpx.post", post)
    texts = ["x" * 3000, "second document chunk"]

    result = embeddings.compute_embeddings(texts)

    assert len(requests) == 1
    url, headers, payload, timeout = requests[0]
    assert url.endswith("/models/gemini-embedding-2:batchEmbedContents")
    assert "unit-test-secret" not in url
    assert headers["x-goog-api-key"] == "unit-test-secret"
    assert payload["requests"][0]["content"]["parts"][0]["text"] == texts[0]
    assert payload["requests"][0]["embedContentConfig"] == {
        "outputDimensionality": 384,
        "autoTruncate": False,
    }
    assert timeout == 15.0
    assert [len(vector) for vector in result] == [384, 384]


def test_compute_embeddings_splits_large_inputs_without_reordering(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-secret")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    batch_sizes = []

    def post(_url, *, json, **_kwargs):
        batch_sizes.append(len(json["requests"]))
        return FakeResponse(len(json["requests"]))

    monkeypatch.setattr("httpx.post", post)

    result = embeddings.compute_embeddings([f"chunk-{index}" for index in range(33)])

    assert batch_sizes == [32, 1]
    assert len(result) == 33


def test_compute_embeddings_retries_rate_limit_with_backoff(monkeypatch):
    import time
    import httpx

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-secret")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    attempts = []
    delays = []

    def post(_url, *, json, **_kwargs):
        attempts.append(len(json["requests"]))
        if len(attempts) == 1:
            request = httpx.Request("POST", "https://generativelanguage.googleapis.com/test")
            response = httpx.Response(429, request=request, headers={"Retry-After": "1"})
            raise httpx.HTTPStatusError("rate limited", request=request, response=response)
        return FakeResponse(len(json["requests"]))

    monkeypatch.setattr("httpx.post", post)
    monkeypatch.setattr(time, "sleep", delays.append)

    result = embeddings.compute_embeddings(["chunk"])

    assert len(result) == 1
    assert attempts == [1, 1]
    assert delays == [1.0]


def test_compute_embeddings_retries_transient_connection_drop(monkeypatch):
    import httpx
    import time

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-secret")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    calls = []
    delays = []

    def post(_url, *, json, **_kwargs):
        calls.append(len(json["requests"]))
        if len(calls) == 1:
            raise httpx.RemoteProtocolError("connection dropped")
        return FakeResponse(len(json["requests"]))

    monkeypatch.setattr("httpx.post", post)
    monkeypatch.setattr(time, "sleep", delays.append)

    result = embeddings.compute_embeddings(["chunk"])

    assert len(result) == 1
    assert calls == [1, 1]
    assert delays == [1.0]


def test_compute_embeddings_rejects_incomplete_or_wrong_dimension_response(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-secret")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    monkeypatch.setattr("httpx.post", lambda *_args, **_kwargs: FakeResponse(1, bad_dimension=True))

    with pytest.raises(RuntimeError, match="expected 384-dimensional"):
        embeddings.compute_embeddings(["chunk"])


def test_compute_embeddings_reports_provider_status_without_logging_secret(monkeypatch, caplog):
    import json
    import httpx

    monkeypatch.setattr(settings, "GEMINI_API_KEY", "unit-test-secret")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL_NAME", "gemini-embedding-2")
    response = httpx.Response(
        429,
        request=httpx.Request("POST", "https://generativelanguage.googleapis.com/test"),
        content=json.dumps({"error": {"status": "RESOURCE_EXHAUSTED", "message": "quota exhausted for unit-test-secret"}}),
    )

    def reject_request(*_args, **_kwargs):
        request = httpx.Request("POST", "https://generativelanguage.googleapis.com/test")
        raise httpx.HTTPStatusError("rate limited", request=request, response=response)

    monkeypatch.setattr("httpx.post", reject_request)

    with pytest.raises(RuntimeError, match="HTTP 429"):
        embeddings.compute_embeddings(["chunk"])

    assert "unit-test-secret" not in caplog.text
    assert "RESOURCE_EXHAUSTED" in caplog.text
    assert "quota exhausted" in caplog.text
