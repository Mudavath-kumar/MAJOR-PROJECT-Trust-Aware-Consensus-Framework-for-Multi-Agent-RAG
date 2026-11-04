import asyncio
import pymongo

from app import main
from app.rag import vectorstore


def test_ai_health_is_not_ready_when_vector_store_is_unavailable(monkeypatch):
    monkeypatch.setattr(main, "get_llm_status", lambda: {"provider": "openrouter"})
    monkeypatch.setattr(main, "is_embedding_model_ready", lambda: True)
    monkeypatch.setattr(main, "is_vector_store_ready", lambda: False)

    result = asyncio.run(main.health())

    assert result["status"] == "offline"
    assert result["ready"] is False
    assert result["vector_store_ready"] is False


def test_ai_health_is_ready_when_all_required_dependencies_are_ready(monkeypatch):
    monkeypatch.setattr(main, "get_llm_status", lambda: {"provider": "openrouter"})
    monkeypatch.setattr(main, "is_embedding_model_ready", lambda: True)
    monkeypatch.setattr(main, "is_vector_store_ready", lambda: True)

    result = asyncio.run(main.health())

    assert result["status"] == "healthy"
    assert result["ready"] is True
    assert result["vector_store_ready"] is True


def test_vector_store_readiness_uses_read_only_ping(monkeypatch):
    commands = []

    class Admin:
        def command(self, name, **kwargs):
            commands.append((name, kwargs))
            return {"ok": 1}

    class Client:
        admin = Admin()

    monkeypatch.setattr(vectorstore, "_client", Client())

    assert vectorstore.is_vector_store_ready() is True
    assert commands == [("ping", {"maxTimeMS": 2000})]


def test_vector_store_readiness_returns_false_when_ping_fails(monkeypatch):
    class Admin:
        def command(self, *_args, **_kwargs):
            raise TimeoutError("not connected")

    class Client:
        admin = Admin()

    monkeypatch.setattr(vectorstore, "_client", Client())

    assert vectorstore.is_vector_store_ready() is False


def test_vector_store_client_keeps_cluster_selection_timeout_long_enough(monkeypatch):
    options = {}

    def create_client(uri, **kwargs):
        options.update(kwargs)
        return object()

    monkeypatch.setattr(pymongo, "MongoClient", create_client)
    monkeypatch.setattr(vectorstore, "_client", None)

    vectorstore._get_client()

    assert options["serverSelectionTimeoutMS"] == 10000
