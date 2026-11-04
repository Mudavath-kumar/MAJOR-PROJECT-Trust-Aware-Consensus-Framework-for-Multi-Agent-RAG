"""Execute one research configuration over a frozen labelled dataset."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import re
import sys
from time import perf_counter
from typing import Any, Callable

from .corpus import load_corpus_manifest, load_corpus_rows
from .runner import load_and_validate_config, load_jsonl, run_experiment, validate_dataset_records
from .variant_runner import ServiceBackend, VariantProfile, run_variant_query


PAPER_COUNTS = {
    "answerable": 100,
    "unanswerable": 50,
    "conflicting": 25,
    "prompt_injection": 25,
}
ContextProvider = Callable[[dict[str, Any], VariantProfile], list[dict[str, Any]]]


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    left_norm = sum(value * value for value in left) ** 0.5
    right_norm = sum(value * value for value in right) ** 0.5
    if not left_norm or not right_norm:
        return 0.0
    return max(0.0, min(1.0, sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)))


def _lexical(query: str, text: str) -> float:
    stop_words = {"a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "of", "on", "or", "the", "to", "what", "where", "which"}
    query_terms = {term for term in re.findall(r"[a-z0-9][a-z0-9_-]{1,}", query.casefold()) if term not in stop_words}
    if not query_terms:
        return 0.0
    text_terms = set(re.findall(r"[a-z0-9][a-z0-9_-]{1,}", text.casefold()))
    return len(query_terms & text_terms) / len(query_terms)


class InMemoryRetriever:
    def __init__(self, rows: list[dict[str, Any]], embedder: Callable[[list[str]], list[list[float]]]):
        self.rows = rows
        self.embedder = embedder
        self.embeddings = embedder([row["text"] for row in rows]) if rows else []
        if len(self.embeddings) != len(self.rows):
            raise ValueError("embedder returned a different number of vectors than corpus rows")

    def search(
        self,
        query: str,
        top_k: int,
        *,
        rerank: bool,
        candidate_k: int,
        document_ids: set[str] | None = None,
    ) -> list[dict[str, Any]]:
        query_embedding = self.embedder([query])[0]
        scored = []
        for row, embedding in zip(self.rows, self.embeddings):
            if document_ids is not None and str((row.get("metadata") or {}).get("document_id")) not in document_ids:
                continue
            semantic = _cosine(query_embedding, embedding)
            lexical = _lexical(query, row["text"])
            if semantic > 0 or (rerank and lexical > 0):
                scored.append((semantic, lexical, row, embedding))
        scored.sort(key=lambda item: item[0], reverse=True)
        selected = scored[: candidate_k if rerank else top_k]
        if rerank:
            selected.sort(
                key=lambda item: max(item[0], item[1]),
                reverse=True,
            )
        return [
            {**row, "similarity_score": round(float(max(semantic, lexical) if rerank else semantic), 4)}
            for semantic, lexical, row, _embedding in selected[:top_k]
        ]


def _default_embedder(texts: list[str]) -> list[list[float]]:
    service_path = str(Path(__file__).resolve().parents[1] / "ai-service")
    if service_path not in sys.path:
        sys.path.insert(0, service_path)
    from app.rag.embeddings import compute_embeddings

    return compute_embeddings(texts)


def _augment_manifest(
    output_dir: Path,
    manifest_path: Path,
    *,
    paper_mode: bool,
    raw_outputs_retained: bool = False,
) -> None:
    path = output_dir / "run-manifest.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    predictions = [
        json.loads(line)
        for line in (output_dir / "predictions-input.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    attempts = [
        attempt
        for prediction in predictions
        for attempt in prediction.get("llm_attempts", [])
    ]
    provider_attempts: dict[str, int] = {}
    model_attempts: dict[str, int] = {}
    successful_provider_models: dict[str, int] = {}
    for attempt in attempts:
        provider = str(attempt.get("provider", "unknown"))
        model = str(attempt.get("model", "unknown"))
        provider_attempts[provider] = provider_attempts.get(provider, 0) + 1
        model_attempts[model] = model_attempts.get(model, 0) + 1
        if attempt.get("succeeded") is True:
            key = f"{provider}/{model}"
            successful_provider_models[key] = successful_provider_models.get(key, 0) + 1
    payload.update(
        {
            "run_mode": "paper" if paper_mode else ("exploratory" if raw_outputs_retained else "smoke"),
            "paper_eligible": paper_mode,
            "raw_outputs_retained": raw_outputs_retained,
            "corpus_manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            "llm_provider_attempts": dict(sorted(provider_attempts.items())),
            "llm_model_attempts": dict(sorted(model_attempts.items())),
            "llm_successful_provider_models": dict(sorted(successful_provider_models.items())),
            "llm_failed_attempts": sum(attempt.get("succeeded") is False for attempt in attempts),
        }
    )
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def run_benchmark(
    config_path: str | Path,
    dataset_path: str | Path,
    manifest_path: str | Path,
    output_dir: str | Path,
    *,
    paper_mode: bool = False,
    backend: Any | None = None,
    context_provider: ContextProvider | None = None,
    embedder: Callable[[list[str]], list[list[float]]] | None = None,
    retain_raw_outputs: bool = False,
) -> Path:
    config_path = Path(config_path)
    dataset_path = Path(dataset_path)
    manifest_path = Path(manifest_path)
    output_path = Path(output_dir)
    if output_path.exists() and (not output_path.is_dir() or any(output_path.iterdir())):
        raise FileExistsError(f"benchmark output directory is not empty: {output_path}")
    config = load_and_validate_config(config_path)
    manifest = load_corpus_manifest(manifest_path)
    dataset = validate_dataset_records(
        load_jsonl(dataset_path),
        paper_mode=paper_mode,
        manifest=manifest,
        expected_counts=PAPER_COUNTS if paper_mode else None,
    )
    if paper_mode and backend is not None:
        raise ValueError("paper mode requires the configured ServiceBackend, not an injected backend")
    profile = VariantProfile.from_config(config)
    service_path = str(Path(__file__).resolve().parents[1] / "ai-service")
    if service_path not in sys.path:
        sys.path.insert(0, service_path)
    from app.core.llm_telemetry import capture_llm_telemetry

    active_backend = backend or ServiceBackend()
    retriever = None
    if context_provider is None:
        rows = load_corpus_rows(manifest)
        retriever = InMemoryRetriever(rows, embedder or _default_embedder)
    output_path.mkdir(parents=True, exist_ok=True)
    partial_predictions_path = output_path / "predictions-input.partial.jsonl"
    execution_state: dict[str, Any] = {
        "completed_prediction_count": 0,
        "failed_record_id": None,
        "failed_llm_attempts": [],
        "failed_prediction": None,
    }

    async def execute() -> list[dict[str, Any]]:
        predictions: list[dict[str, Any]] = []
        with partial_predictions_path.open("w", encoding="utf-8", newline="\n") as handle:
            for record in dataset:
                started = perf_counter()
                telemetry = None
                prediction = None
                execution_state["failed_record_id"] = str(record["id"])
                try:
                    with capture_llm_telemetry() as telemetry:
                        context = (
                            context_provider(record, profile)
                            if context_provider is not None
                            else retriever.search(
                                record["question"],
                                profile.top_k,
                                rerank=profile.reranking_enabled,
                                candidate_k=int(config["retrieval"].get("candidate_k", profile.top_k)),
                                document_ids={
                                    str(document["document_id"])
                                    for document in record.get("documents", [])
                                },
                            )
                        )
                        prediction = await run_variant_query(
                            profile,
                            record["question"],
                            context,
                            active_backend,
                            record_id=str(record["id"]),
                        )
                    if not paper_mode and not retain_raw_outputs:
                        prediction.pop("retrieved_evidence", None)
                        prediction.pop("agent_outputs", None)
                    prediction["llm_calls"] = len(telemetry.attempts)
                    prediction["llm_attempts"] = [dict(attempt) for attempt in telemetry.attempts]
                    prediction["latency_ms"] = max(0, round((perf_counter() - started) * 1000))
                    if paper_mode and prediction["status"] != "abstain" and not any(
                        attempt.get("succeeded") is True for attempt in telemetry.attempts
                    ):
                        raise RuntimeError(
                            f"paper query {record['id']} returned an answer without a successful provider call"
                        )
                    predictions.append(prediction)
                    handle.write(json.dumps(prediction, sort_keys=True, ensure_ascii=False) + "\n")
                    handle.flush()
                    execution_state["completed_prediction_count"] = len(predictions)
                    execution_state["failed_record_id"] = None
                except Exception:
                    execution_state["failed_llm_attempts"] = [
                        dict(attempt) for attempt in (telemetry.attempts if telemetry else [])
                    ]
                    execution_state["failed_prediction"] = prediction
                    raise
        return predictions

    try:
        predictions = asyncio.run(execute())
        if paper_mode and not any(
            attempt.get("succeeded") is True
            for prediction in predictions
            for attempt in prediction.get("llm_attempts", [])
        ):
            raise RuntimeError("paper benchmark made no successful LLM provider calls")
        predictions_path = output_path / "predictions-input.jsonl"
        partial_predictions_path.replace(predictions_path)
        run_experiment(config_path, dataset_path, predictions_path, output_path)
        _augment_manifest(
            output_path,
            manifest_path,
            paper_mode=paper_mode,
            raw_outputs_retained=retain_raw_outputs,
        )
        return output_path
    except Exception as exc:
        error_manifest = {
            "run_mode": "paper" if paper_mode else "smoke",
            "paper_eligible": False,
            "status": "error",
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            **execution_state,
            "partial_predictions_file": (
                partial_predictions_path.name if partial_predictions_path.is_file() else None
            ),
        }
        output_path.mkdir(parents=True, exist_ok=True)
        (output_path / "error-manifest.json").write_text(
            json.dumps(error_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--paper", action="store_true", help="require the reviewed 200-record composition")
    parser.add_argument(
        "--retain-raw-outputs",
        action="store_true",
        help="retain evidence and stage outputs for a non-paper exploratory run",
    )
    args = parser.parse_args()
    print(
        run_benchmark(
            args.config,
            args.dataset,
            args.manifest,
            args.output_dir,
            paper_mode=args.paper,
            retain_raw_outputs=args.retain_raw_outputs,
        )
    )


if __name__ == "__main__":
    main()
