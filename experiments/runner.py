"""Replayable experiment runner for labelled TrustRAG predictions."""

from __future__ import annotations

import argparse
from collections import Counter
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
REVIEW_AUDIT_VERSION = "trustrag-review-consistency-v1"
REVIEW_CANDIDATE_VERSION = "trustrag-public-candidate-v4"
REQUIRED_CONFIG_FIELDS = (
    "name",
    "dataset_version",
    "system",
    "model",
    "embedding_model",
    "prompt_version",
    "temperature",
    "retrieval",
    "orchestration",
    "verification",
    "seed",
)
ORCHESTRATION_MODES = {"single-pass", "fixed-multi-agent", "trust-aware-consensus"}
VERIFICATION_MODES = {"none", "typed-claims"}
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


def review_protocol_metadata(records: Iterable[dict[str, Any]], *, require_approved: bool = False) -> dict[str, Any]:
    records = list(records)
    reviews = [record.get("review") for record in records]
    if not records or not all(isinstance(review, dict) for review in reviews):
        if require_approved:
            raise ValueError("paper dataset requires completed review metadata")
        return {"review_protocol": "unreviewed", "human_reviewer_count": 0}

    if all(
        review.get("reviewer_a") == "approved"
        and review.get("reviewer_b") == "approved"
        and review.get("resolution") == "resolved"
        for review in reviews
    ):
        return {"review_protocol": "two-human-independent", "human_reviewer_count": 2}

    protocol = "one-human-plus-automated"
    audit_fields = ("status", "version", "audit_sha256", "source_sha256", "candidate_sha256", "manifest_sha256")
    expected_audit = None
    for record, review in zip(records, reviews):
        if review.get("review_protocol") != protocol or review.get("human_reviewer_count") != 1 or review.get("human_review_status") != "approved":
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} requires valid human review metadata")
        if "reviewer_a" in review or "reviewer_b" in review:
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} must not claim a second human reviewer")
        try:
            datetime.fromisoformat(str(review["reviewed_at"]).replace("Z", "+00:00"))
        except (KeyError, ValueError):
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} has invalid reviewed_at")
        audit = review.get("automated_audit")
        if not isinstance(audit, dict) or audit.get("status") != "passed" or audit.get("version") != REVIEW_AUDIT_VERSION:
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} requires a passing automated review audit")
        if any(not isinstance(audit.get(field), str) or not re.fullmatch(r"[a-f0-9]{64}", audit[field]) for field in audit_fields if field.endswith("sha256")):
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} has invalid review audit hashes")
        expected_hash = hashlib.sha256(
            "\n".join([audit["source_sha256"], audit["candidate_sha256"], audit["manifest_sha256"], audit["version"]]).encode()
        ).hexdigest()
        if audit["audit_sha256"] != expected_hash:
            raise ValueError(f"dataset record {record.get('id', '<unknown>')} has a mismatched review audit hash")
        fingerprint = tuple(audit.get(field) for field in audit_fields)
        if expected_audit is None:
            expected_audit = fingerprint
        elif fingerprint != expected_audit:
            raise ValueError("paper dataset contains inconsistent automated review audit metadata")
    return {
        "review_protocol": protocol,
        "human_reviewer_count": 1,
        "review_audit_version": REVIEW_AUDIT_VERSION,
        "review_audit_sha256": expected_audit[2] if expected_audit else None,
    }


def _validate_reviewed_candidate_export(records: list[dict[str, Any]]) -> None:
    dataset_dir = Path(__file__).resolve().parent / "datasets" / REVIEW_CANDIDATE_VERSION
    candidate_path = dataset_dir / "trustrag-project-draft.jsonl"
    manifest_path = dataset_dir / "trustrag-v1.manifest.json"
    source_path = Path(__file__).resolve().parent / "datasets" / "hotpot-validation-sampled-200.source.json"
    expected_paths = (candidate_path, manifest_path, source_path)
    if not all(path.is_file() for path in expected_paths):
        raise ValueError("one-human paper review requires the checked-in v4 candidate, source snapshot, and corpus manifest")
    hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in expected_paths]
    review = records[0].get("review") or {}
    audit = review.get("automated_audit") or {}
    if [audit.get("candidate_sha256"), audit.get("manifest_sha256"), audit.get("source_sha256")] != hashes:
        raise ValueError("review audit source, candidate, or manifest hashes do not match the checked-in v4 dataset")

    corpus_manifest = _read_json(manifest_path)
    synthetic_evidence_ids = {
        str(chunk.get("evidence_id"))
        for source in corpus_manifest.get("sources", [])
        if "synthetic-conflict" in str(source.get("path", ""))
        for chunk in source.get("chunks", [])
    }
    for record in records:
        if record.get("answer_type") == "conflicting" and synthetic_evidence_ids.intersection(map(str, record.get("gold_evidence_ids", []))):
            raise ValueError(f"reviewed record {record['id']} labels a synthetic conflict chunk as gold evidence")

    original_records = load_jsonl(candidate_path)
    original_by_id = {str(record["id"]): record for record in original_records}
    if len(records) != len(original_by_id) or {str(record["id"]) for record in records} != set(original_by_id):
        raise ValueError("one-human review export must contain the complete checked-in v4 candidate")
    for reviewed_record in records:
        original = original_by_id[str(reviewed_record["id"])]
        reviewed_base = {key: value for key, value in reviewed_record.items() if key != "review"}
        original_base = {key: value for key, value in original.items() if key != "review"}
        if reviewed_base != original_base:
            raise ValueError(f"reviewed record {reviewed_record['id']} differs from the frozen v4 candidate")


def load_and_validate_config(path: str | Path) -> dict[str, Any]:
    config = _read_json(Path(path))
    for field in REQUIRED_CONFIG_FIELDS:
        if field not in config:
            raise ValueError(f"config requires {field}")
    if not isinstance(config["retrieval"], dict):
        raise ValueError("config retrieval must be an object")
    for field in ("top_k", "chunk_size", "chunk_overlap", "reranking"):
        if field not in config["retrieval"]:
            raise ValueError(f"config retrieval requires {field}")
    reranking = config["retrieval"]["reranking"]
    if not isinstance(reranking, dict) or not isinstance(reranking.get("enabled"), bool):
        raise ValueError("config retrieval reranking requires a boolean enabled field")
    for field in ("orchestration", "verification"):
        if not isinstance(config[field], dict):
            raise ValueError(f"config {field} must be an object")
    if config["orchestration"].get("mode") not in ORCHESTRATION_MODES:
        raise ValueError("config orchestration mode is unsupported")
    if config["verification"].get("mode") not in VERIFICATION_MODES:
        raise ValueError("config verification mode is unsupported")
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


def validate_dataset_records(
    records: Iterable[dict[str, Any]],
    *,
    paper_mode: bool = False,
    manifest: dict[str, Any] | None = None,
    expected_counts: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
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
        if record["answer_type"] in {"answerable", "prompt_injection"} and not record["gold_evidence_ids"]:
            raise ValueError(f"dataset record {record_id} requires gold evidence for answerable questions and prompt-injection resilience cases")
        if record["answer_type"] in {"answerable", "prompt_injection"} and not str(record["gold_answer"]).strip():
            raise ValueError(f"dataset record {record_id} requires a gold answer for answerable questions and prompt-injection resilience cases")
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
        if paper_mode:
            review_protocol_metadata([record], require_approved=True)

    if paper_mode:
        protocol = review_protocol_metadata(records, require_approved=True)
        if protocol["review_protocol"] == "one-human-plus-automated":
            _validate_reviewed_candidate_export(records)

    if manifest is not None:
        manifest_sources = {
            str(source.get("document_id")): source
            for source in manifest.get("sources", [])
            if isinstance(source, dict) and source.get("document_id")
        }
        manifest_evidence = {
            str(chunk.get("evidence_id"))
            for source in manifest_sources.values()
            for chunk in source.get("chunks", [])
            if chunk.get("evidence_id")
        }
        for record in records:
            for document in record["documents"]:
                document_id = str(document["document_id"])
                source = manifest_sources.get(document_id)
                if source is None:
                    raise ValueError(f"dataset record {record['id']} references unknown document")
                if document["snapshot_sha256"] != source.get("snapshot_sha256"):
                    raise ValueError(f"dataset record {record['id']} has a stale document snapshot")
            unknown_evidence = set(map(str, record["gold_evidence_ids"])) - manifest_evidence
            if unknown_evidence:
                raise ValueError(
                    f"dataset record {record['id']} references unknown evidence: "
                    + ", ".join(sorted(unknown_evidence))
                )
        if manifest.get("dataset_version") and any(
            record["dataset_version"] != manifest["dataset_version"] for record in records
        ):
            raise ValueError("dataset version does not match corpus manifest")

    if paper_mode and expected_counts is not None:
        actual_counts = Counter(record["answer_type"] for record in records)
        if dict(actual_counts) != dict(expected_counts):
            raise ValueError(
                f"dataset answer-type composition {dict(actual_counts)} does not match "
                f"expected {dict(expected_counts)}"
            )
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
    review_metadata = review_protocol_metadata(dataset)
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
        **review_metadata,
        "system": config["system"],
        "model": config["model"],
        "embedding_model": config["embedding_model"],
        "prompt_version": config["prompt_version"],
        "temperature": config["temperature"],
        "retrieval": config["retrieval"],
        "orchestration": config["orchestration"],
        "verification": config["verification"],
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
