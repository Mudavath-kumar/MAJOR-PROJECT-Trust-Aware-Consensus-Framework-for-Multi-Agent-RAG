"""Dataset authoring helpers that deliberately create review-gated drafts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .corpus import build_corpus_manifest


def build_review_template(
    manifest: dict[str, Any], output_path: str | Path, record_count: int
) -> Path:
    if record_count <= 0:
        raise ValueError("record_count must be positive")
    sources = manifest.get("sources") or []
    if not sources:
        raise ValueError("manifest must contain at least one source")
    documents = [
        {
            "document_id": source["document_id"],
            "snapshot_sha256": source["snapshot_sha256"],
        }
        for source in sources
    ]
    dataset_version = str(manifest.get("dataset_version", ""))
    if not dataset_version:
        raise ValueError("manifest dataset_version is required")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        for index in range(1, record_count + 1):
            record = {
                "id": f"draft-{index:04d}",
                "dataset_version": dataset_version,
                "question": f"[REVIEW REQUIRED] Replace draft question {index}.",
                "answer_type": "unanswerable",
                "gold_answer": "",
                "gold_evidence_ids": [],
                "documents": documents,
                "review": {
                    "reviewer_a": "pending",
                    "reviewer_b": "pending",
                    "resolution": "pending",
                },
            }
            handle.write(json.dumps(record, sort_keys=True) + "\n")
    return output


def build_initial_dataset(
    source_list_path: str | Path,
    manifest_path: str | Path,
    draft_path: str | Path,
    *,
    dataset_version: str = "trustrag-v1",
    record_count: int = 200,
) -> dict[str, Any]:
    sources = json.loads(Path(source_list_path).read_text(encoding="utf-8"))
    if not isinstance(sources, list) or not all(isinstance(source, str) for source in sources):
        raise ValueError("source list must be a JSON array of paths")
    manifest = build_corpus_manifest(sources, manifest_path, dataset_version)
    build_review_template(manifest, draft_path, record_count)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--draft", required=True, type=Path)
    parser.add_argument("--dataset-version", default="trustrag-v1")
    parser.add_argument("--record-count", type=int, default=200)
    args = parser.parse_args()
    build_initial_dataset(
        args.sources,
        args.manifest,
        args.draft,
        dataset_version=args.dataset_version,
        record_count=args.record_count,
    )
    print(args.manifest)


if __name__ == "__main__":
    main()
