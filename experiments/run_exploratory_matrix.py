"""Run the six variants on an automated-reviewed subset, explicitly provisionally."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Callable

from .corpus import load_corpus_manifest, load_corpus_rows
from .report import render_comparison_report
from .run_benchmark import InMemoryRetriever, _default_embedder, run_benchmark
from .run_matrix import CONFIG_DIR, SHARED_CONFIG_FIELDS, VARIANT_CONFIGS
from .runner import load_and_validate_config, load_jsonl, validate_dataset_records


class _MemoizedEmbedder:
    def __init__(
        self,
        embedder: Callable[[list[str]], list[list[float]]],
        *,
        cache_path: str | Path | None = None,
        model: str | None = None,
    ) -> None:
        self._embedder = embedder
        self._cache: dict[str, list[float]] = {}
        self._cache_path = Path(cache_path) if cache_path is not None else None
        self._model = model
        if self._cache_path is not None:
            self._load_or_initialize_cache()

    def _load_or_initialize_cache(self) -> None:
        assert self._cache_path is not None
        self._cache_path.parent.mkdir(parents=True, exist_ok=True)
        if not self._cache_path.exists():
            metadata = {"type": "metadata", "embedding_model": self._model}
            self._cache_path.write_text(json.dumps(metadata) + "\n", encoding="utf-8")
            return
        lines = self._cache_path.read_text(encoding="utf-8").splitlines()
        if not lines:
            raise ValueError("embedding cache is empty and has no model metadata")
        metadata = json.loads(lines[0])
        if metadata != {"type": "metadata", "embedding_model": self._model}:
            raise ValueError("embedding cache metadata does not match the configured embedding model")
        for line in lines[1:]:
            entry = json.loads(line)
            key, vector = entry.get("sha256"), entry.get("vector")
            if not isinstance(key, str) or len(key) != 64 or not isinstance(vector, list):
                raise ValueError("embedding cache contains a malformed vector entry")
            if any(isinstance(value, bool) or not isinstance(value, (int, float)) for value in vector):
                raise ValueError("embedding cache contains nonnumeric vector values")
            self._cache[key] = [float(value) for value in vector]

    def __call__(self, texts: list[str]) -> list[list[float]]:
        keys = {text: hashlib.sha256(text.encode("utf-8")).hexdigest() for text in texts}
        missing = list(dict.fromkeys(text for text in texts if keys[text] not in self._cache))
        if missing:
            vectors = self._embedder(missing)
            if len(vectors) != len(missing):
                raise ValueError("embedder returned a different number of vectors than requested")
            for text, vector in zip(missing, vectors):
                self._cache[keys[text]] = [float(value) for value in vector]
            if self._cache_path is not None:
                with self._cache_path.open("a", encoding="utf-8", newline="\n") as handle:
                    for text, vector in zip(missing, vectors):
                        handle.write(json.dumps({"sha256": keys[text], "vector": vector}) + "\n")
                    handle.flush()
        return [self._cache[keys[text]] for text in texts]


def run_exploratory_matrix(
    dataset_path: str | Path,
    manifest_path: str | Path,
    output_dir: str | Path,
    *,
    benchmark_runner: Callable[..., Path] | None = None,
    report_renderer: Callable[..., dict] | None = None,
    embedding_cache: str | Path | None = None,
) -> Path:
    dataset_path, manifest_path, output_path = map(Path, (dataset_path, manifest_path, output_dir))
    if output_path.exists() and (not output_path.is_dir() or any(output_path.iterdir())):
        raise FileExistsError(f"output path is not a new or empty directory: {output_path}")

    records = validate_dataset_records(
        load_jsonl(dataset_path), manifest=load_corpus_manifest(manifest_path)
    )
    if not records:
        raise ValueError("exploratory dataset has no approved examples")
    for record in records:
        review = record.get("automated_review")
        if (
            not isinstance(review, dict)
            or review.get("decision") != "Approved"
            or review.get("reviewer_type") != "automated"
            or record.get("human_review_status") != "pending"
            or "review" in record
        ):
            raise ValueError(
                f"exploratory record {record['id']} must have an automated approval, pending human status, and no claimed human review"
            )

    configs = [
        (variant, CONFIG_DIR / f"{variant}.json", load_and_validate_config(CONFIG_DIR / f"{variant}.json"))
        for variant in VARIANT_CONFIGS
    ]
    for variant, _path, config in configs:
        if config.get("name") != variant:
            raise ValueError(f"variant config name does not match filename: {variant}")
        if config["dataset_version"] != records[0]["dataset_version"]:
            raise ValueError(f"variant {variant} dataset version does not match the dataset")
    for field in SHARED_CONFIG_FIELDS:
        if len({config.get(field) for _variant, _path, config in configs}) != 1:
            raise ValueError(f"all exploratory variants must share {field}")

    output_path.mkdir(parents=True, exist_ok=True)
    execute = benchmark_runner or run_benchmark
    render = report_renderer or render_comparison_report
    try:
        rows = load_corpus_rows(load_corpus_manifest(manifest_path))
        embedding_model = next(config["embedding_model"] for _variant, _path, config in configs)
        cache_path = Path(embedding_cache) if embedding_cache is not None else output_path / "embedding-cache.jsonl"
        retriever = InMemoryRetriever(
            rows,
            _MemoizedEmbedder(_default_embedder, cache_path=cache_path, model=embedding_model),
        )
    except Exception as exc:
        failure = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "error",
            "run_mode": "exploratory",
            "paper_eligible": False,
            "phase": "corpus_embedding",
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "dataset_sha256": hashlib.sha256(dataset_path.read_bytes()).hexdigest(),
            "corpus_manifest_sha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            "candidate_count": len(records),
        }
        (output_path / "preflight-error.json").write_text(
            json.dumps(failure, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        raise
    candidate_k_by_variant = {
        variant: int(config["retrieval"].get("candidate_k", config["retrieval"]["top_k"]))
        for variant, _path, config in configs
    }

    def retrieve(record, profile):
        return retriever.search(
            record["question"],
            profile.top_k,
            rerank=profile.reranking_enabled,
            candidate_k=candidate_k_by_variant[profile.name],
            document_ids={str(document["document_id"]) for document in record.get("documents", [])},
        )

    run_dirs: list[Path] = []
    for variant, config_path, _config in configs:
        run_dirs.append(
            execute(
                config_path,
                dataset_path,
                manifest_path,
                output_path / variant,
                paper_mode=False,
                retain_raw_outputs=True,
                context_provider=retrieve,
            )
        )
    report_path = output_path / "report"
    render(run_dirs, report_path, baseline="baseline-rag", allow_provisional=True)
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--embedding-cache", type=Path)
    args = parser.parse_args()
    print(run_exploratory_matrix(args.dataset, args.manifest, args.output_dir, embedding_cache=args.embedding_cache))


if __name__ == "__main__":
    main()
