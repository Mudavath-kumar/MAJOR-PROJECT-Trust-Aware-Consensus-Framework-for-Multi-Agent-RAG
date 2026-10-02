"""Replayable experiment runner for labelled TrustRAG predictions."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from typing import Any, Iterable

from .metrics import calculate_metrics


RUNNER_VERSION = "trustrag-eval-1"
REQUIRED_CONFIG_FIELDS = (
    "name",
    "dataset_version",
    "system",
    "model",
    "embedding_model",
    "prompt_version",
    "temperature",
    "retrieval",
    "seed",
)
SECRET_PATTERNS = (
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"sk-or-v1-[0-9A-Za-z]+"),
    re.compile(r"tvly-[0-9A-Za-z_-]+"),
    re.compile(r"mongodb(?:\+srv)?://", re.IGNORECASE),
    re.compile(r"(?:B2_APPLICATION_KEY|JWT_SECRET)\s*[:=]", re.IGNORECASE),
)


def _read_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON file {path}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"JSON file {path} must contain an object")
    return payload


def _assert_no_secrets(value: Any, location: str = "artifact") -> None:
    serialized = json.dumps(value, ensure_ascii=False)
    if any(pattern.search(serialized) for pattern in SECRET_PATTERNS):
        raise ValueError(f"secret-like value detected in {location}; remove it before running")


def load_and_validate_config(path: str | Path) -> dict[str, Any]:
    config = _read_json(Path(path))
    for field in REQUIRED_CONFIG_FIELDS:
        if field not in config:
            raise ValueError(f"config requires {field}")
    if not isinstance(config["retrieval"], dict):
        raise ValueError("config retrieval must be an object")
    for field in ("top_k", "chunk_size", "chunk_overlap"):
        if field not in config["retrieval"]:
            raise ValueError(f"config retrieval requires {field}")
    if not isinstance(config["seed"], int):
        raise ValueError("config seed must be an integer")
    if not isinstance(config["temperature"], (int, float)) or not 0 <= config["temperature"] <= 2:
        raise ValueError("config temperature must be between 0 and 2")
    _assert_no_secrets(config, "config")
    return config


def load_jsonl(path: str | Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for line_number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"invalid JSONL at line {line_number}") from exc
        if not isinstance(record, dict) or not record.get("id"):
            raise ValueError(f"JSONL line {line_number} requires an object with id")
        record_id = str(record["id"])
        if record_id in seen:
            raise ValueError(f"duplicate id {record_id}")
        seen.add(record_id)
        records.append(record)
    if not records:
        raise ValueError(f"JSONL file {path} is empty")
    _assert_no_secrets(records, str(path))
    return records


def validate_dataset_records(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    records = list(records)
    required = {
        "id",
        "dataset_version",
        "question",
        "answer_type",
        "gold_answer",
        "gold_evidence_ids",
        "documents",
    }
    seen: set[str] = set()
    snapshot_pattern = re.compile(r"^[a-f0-9]{64}$")
    for record in records:
        missing = sorted(required - record.keys())
        if missing:
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} missing {', '.join(missing)}")
        record_id = str(record["id"])
        if not record_id.strip():
            raise ValueError("dataset record id must be non-empty")
        if record_id in seen:
            raise ValueError(f"duplicate dataset id {record_id}")
        seen.add(record_id)
        if record["answer_type"] not in {"answerable", "unanswerable", "conflicting", "prompt_injection"}:
            raise ValueError(f"dataset record {record_id} has unsupported answer_type")
        if not isinstance(record["gold_evidence_ids"], list):
            raise ValueError(f"dataset record {record_id} gold_evidence_ids must be a list")
        if record["answer_type"] == "answerable" and not record["gold_evidence_ids"]:
            raise ValueError(f"dataset record {record_id} requires gold evidence for answerable questions")
        if len(set(record["gold_evidence_ids"])) != len(record["gold_evidence_ids"]):
            raise ValueError(f"dataset record {record_id} has duplicate gold evidence IDs")
        if not isinstance(record["documents"], list) or not record["documents"]:
            raise ValueError(f"dataset record {record_id} requires documents")
        for document in record["documents"]:
            if not isinstance(document, dict) or not document.get("document_id"):
                raise ValueError(f"dataset record {record_id} has an invalid document")
            snapshot = str(document.get("snapshot_sha256", ""))
            if not snapshot_pattern.fullmatch(snapshot):
                raise ValueError(f"dataset record {record_id} has invalid snapshot_sha256")
    _assert_no_secrets(records, "dataset")
    return records


def merge_predictions(
    dataset: Iterable[dict[str, Any]], predictions: Iterable[dict[str, Any]]
) -> list[dict[str, Any]]:
    dataset_records = list(dataset)
    prediction_records = list(predictions)
    dataset_ids = [str(item.get("id", "")) for item in dataset_records]
    if not all(dataset_ids) or len(set(dataset_ids)) != len(dataset_ids):
        raise ValueError("dataset ids must be non-empty and unique")
    prediction_map: dict[str, dict[str, Any]] = {}
    for prediction in prediction_records:
        prediction_id = str(prediction.get("id", ""))
        if not prediction_id:
            raise ValueError("prediction id is required")
        if prediction_id in prediction_map:
            raise ValueError(f"duplicate prediction id {prediction_id}")
        prediction_map[prediction_id] = prediction
    missing = [record_id for record_id in dataset_ids if record_id not in prediction_map]
    extra = sorted(set(prediction_map) - set(dataset_ids))
    if missing:
        raise ValueError(f"missing predictions for {', '.join(missing)}")
    if extra:
        raise ValueError(f"predictions contain unknown ids: {', '.join(extra)}")
    merged = []
    for dataset_record in dataset_records:
        merged_record = {**dataset_record, **prediction_map[str(dataset_record["id"])]}
        merged.append(merged_record)
    return merged


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _git_revision() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def run_experiment(
    config_path: str | Path,
    dataset_path: str | Path,
    predictions_path: str | Path,
    output_dir: str | Path,
) -> Path:
    config_path = Path(config_path)
    dataset_path = Path(dataset_path)
    predictions_path = Path(predictions_path)
    output_path = Path(output_dir)
    config = load_and_validate_config(config_path)
    dataset = validate_dataset_records(load_jsonl(dataset_path))
    predictions = load_jsonl(predictions_path)
    records = merge_predictions(dataset, predictions)
    metrics = calculate_metrics(records, k=int(config["retrieval"]["top_k"]))
    _assert_no_secrets(records, "merged predictions")

    output_path.mkdir(parents=True, exist_ok=True)
    (output_path / "config.json").write_text(json.dumps(config, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    with (output_path / "predictions.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, sort_keys=True, ensure_ascii=False) + "\n")
    (output_path / "metrics.json").write_text(json.dumps(metrics, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest = {
        "runner_version": RUNNER_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "git_revision": _git_revision(),
        "python_version": sys.version.split()[0],
        "dataset_version": config["dataset_version"],
        "system": config["system"],
        "model": config["model"],
        "embedding_model": config["embedding_model"],
        "prompt_version": config["prompt_version"],
        "temperature": config["temperature"],
        "retrieval": config["retrieval"],
        "seed": config["seed"],
        "sample_count": len(records),
        "config_sha256": _sha256(config_path),
        "dataset_sha256": _sha256(dataset_path),
        "predictions_sha256": _sha256(predictions_path),
        "status_counts": metrics["status_counts"],
    }
    (output_path / "run-manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    print(run_experiment(args.config, args.dataset, args.predictions, args.output_dir))


if __name__ == "__main__":
    main()
