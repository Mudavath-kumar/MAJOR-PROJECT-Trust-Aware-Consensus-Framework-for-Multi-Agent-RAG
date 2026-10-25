import hashlib
import json
from pathlib import Path

import pytest

from experiments.corpus import load_corpus_manifest
from experiments.runner import review_protocol_metadata, validate_dataset_records


def _review(
    protocol="one-human-plus-automated",
    *,
    audit_status="passed",
    reviewer_count=1,
    source_hash="a" * 64,
    candidate_hash="b" * 64,
    manifest_hash="c" * 64,
):
    audit_version = "trustrag-review-consistency-v1"
    audit_hash = hashlib.sha256(
        "\n".join([source_hash, candidate_hash, manifest_hash, audit_version]).encode()
    ).hexdigest()
    return {
        "review_protocol": protocol,
        "human_reviewer_count": reviewer_count,
        "human_review_status": "approved",
        "reviewed_at": "2026-10-25T00:00:00.000Z",
        "automated_audit": {
            "status": audit_status,
            "version": audit_version,
            "audit_sha256": audit_hash,
            "source_sha256": source_hash,
            "candidate_sha256": candidate_hash,
            "manifest_sha256": manifest_hash,
        },
    }


def _record(review):
    return {
        "id": "q-0001",
        "dataset_version": "trustrag-v1",
        "question": "What is tested?",
        "answer_type": "answerable",
        "gold_answer": "A",
        "gold_evidence_ids": ["doc-1:chunk_1"],
        "documents": [{"document_id": "doc-1", "snapshot_sha256": "d" * 64}],
        "review": review,
    }


def test_paper_review_adapter_accepts_single_human_plus_consistency_audit():
    dataset_dir = Path(__file__).parents[1] / "datasets" / "trustrag-public-candidate-v4"
    candidate_path = dataset_dir / "trustrag-project-draft.jsonl"
    manifest_path = dataset_dir / "trustrag-v1.manifest.json"
    source_path = Path(__file__).parents[1] / "datasets" / "hotpot-validation-sampled-200.source.json"
    hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (source_path, candidate_path, manifest_path)]
    records = [json.loads(line) for line in candidate_path.read_text(encoding="utf-8").splitlines()]
    for record in records:
        record["review"] = _review(source_hash=hashes[0], candidate_hash=hashes[1], manifest_hash=hashes[2])
    records = validate_dataset_records(
        records,
        paper_mode=True,
        manifest=load_corpus_manifest(manifest_path),
        expected_counts={"answerable": 100, "unanswerable": 50, "conflicting": 25, "prompt_injection": 25},
    )

    assert len(records) == 200
    assert records[0]["review"]["human_reviewer_count"] == 1
    assert records[0]["review"]["review_protocol"] == "one-human-plus-automated"


@pytest.mark.parametrize(
    "review",
    [
        _review(audit_status="failed"),
        _review(reviewer_count=2),
        {**_review(), "automated_audit": {**_review()["automated_audit"], "audit_sha256": "0" * 64}},
        {**_review(), "reviewer_b": "approved"},
    ],
)
def test_paper_review_adapter_rejects_failed_or_misrepresented_human_review(review):
    with pytest.raises(ValueError, match="review"):
        review_protocol_metadata([_record(review)], require_approved=True)


def test_paper_review_adapter_preserves_two_human_approval_contract():
    record = _record({"reviewer_a": "approved", "reviewer_b": "approved", "resolution": "resolved"})

    assert review_protocol_metadata([record], require_approved=True)["review_protocol"] == "two-human-independent"


def test_paper_review_adapter_rejects_export_rows_changed_after_human_review():
    dataset_dir = Path(__file__).parents[1] / "datasets" / "trustrag-public-candidate-v4"
    candidate_path = dataset_dir / "trustrag-project-draft.jsonl"
    manifest_path = dataset_dir / "trustrag-v1.manifest.json"
    source_path = Path(__file__).parents[1] / "datasets" / "hotpot-validation-sampled-200.source.json"
    hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in (source_path, candidate_path, manifest_path)]
    records = [json.loads(line) for line in candidate_path.read_text(encoding="utf-8").splitlines()]
    for record in records:
        record["review"] = _review(source_hash=hashes[0], candidate_hash=hashes[1], manifest_hash=hashes[2])
    records[0]["gold_answer"] = "Tampered"

    with pytest.raises(ValueError, match="frozen v4 candidate"):
        validate_dataset_records(records, paper_mode=True)


def test_v4_conflict_gold_evidence_excludes_synthetic_challenge_chunks():
    dataset_dir = Path(__file__).parents[1] / "datasets" / "trustrag-public-candidate-v4"
    records = [json.loads(line) for line in (dataset_dir / "trustrag-project-draft.jsonl").read_text(encoding="utf-8").splitlines()]
    manifest = load_corpus_manifest(dataset_dir / "trustrag-v1.manifest.json")
    synthetic_ids = {
        chunk["evidence_id"]
        for source in manifest["sources"]
        if "synthetic-conflict" in source["path"]
        for chunk in source["chunks"]
    }
    conflicts = [record for record in records if record["answer_type"] == "conflicting"]

    assert len(conflicts) == 25
    assert all(record["gold_evidence_ids"] for record in conflicts)
    assert all(not (set(record["gold_evidence_ids"]) & synthetic_ids) for record in conflicts)
