"""Context-local telemetry for actual provider requests made by the LLM router."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from typing import Iterator


@dataclass
class LLMTelemetry:
    attempts: list[dict[str, str | bool | None]] = field(default_factory=list)


_active_telemetry: ContextVar[LLMTelemetry | None] = ContextVar(
    "trustrag_llm_telemetry", default=None
)


@contextmanager
def capture_llm_telemetry() -> Iterator[LLMTelemetry]:
    """Capture actual provider attempts within the current request context."""
    telemetry = LLMTelemetry()
    token: Token[LLMTelemetry | None] = _active_telemetry.set(telemetry)
    try:
        yield telemetry
    finally:
        _active_telemetry.reset(token)


def record_llm_attempt(provider: str, model: str) -> dict[str, str | bool | None] | None:
    telemetry = _active_telemetry.get()
    if telemetry is None:
        return None
    attempt: dict[str, str | bool | None] = {
        "provider": provider,
        "model": model,
        "succeeded": None,
    }
    telemetry.attempts.append(attempt)
    return attempt


def complete_llm_attempt(
    attempt: dict[str, str | bool | None] | None, *, succeeded: bool
) -> None:
    if attempt is not None:
        attempt["succeeded"] = succeeded
