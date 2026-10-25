import json

import pytest

from experiments.corpus import build_corpus_manifest
from experiments.dataset_builder import build_review_template
from experiments.runner import validate_dataset_records


def test_review_template_is_pending_and_paper_mode_rejects_it(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("A short project-owned policy document.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    dataset_path = tmp_path / "dataset.jsonl"

    build_review_template(manifest, dataset_path, record_count=2)
    records = [json.loads(line) for line in dataset_path.read_text(encoding="utf-8").splitlines()]

    validate_dataset_records(records, paper_mode=False, manifest=manifest)
    with pytest.raises(ValueError, match="review"):
        validate_dataset_records(records, paper_mode=True, manifest=manifest)


def test_paper_mode_rejects_evidence_not_in_manifest(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("A short project-owned policy document.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    record = {
        "id": "q-0001",
        "dataset_version": "test-v1",
        "question": "What does the policy say?",
        "answer_type": "answerable",
        "gold_answer": "It states a policy.",
        "gold_evidence_ids": ["missing:chunk-1"],
        "documents": [
            {
                "document_id": manifest["sources"][0]["document_id"],
                "snapshot_sha256": manifest["sources"][0]["snapshot_sha256"],
            }
        ],
        "review": {"reviewer_a": "approved", "reviewer_b": "approved", "resolution": "resolved"},
    }

    with pytest.raises(ValueError, match="evidence"):
        validate_dataset_records([record], paper_mode=True, manifest=manifest)
