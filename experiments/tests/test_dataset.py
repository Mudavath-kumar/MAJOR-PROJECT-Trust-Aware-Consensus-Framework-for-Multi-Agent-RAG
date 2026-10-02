import pytest

from experiments.runner import validate_dataset_records


def _record(**overrides):
    value = {
        "id": "q1",
        "dataset_version": "v1",
        "question": "Where is the office?",
        "answer_type": "answerable",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["doc-1:chunk-1"],
        "documents": [{"document_id": "doc-1", "snapshot_sha256": "a" * 64}],
    }
    value.update(overrides)
    return value


def test_dataset_validation_requires_gold_evidence_for_answerable_records():
    with pytest.raises(ValueError, match="gold evidence"):
        validate_dataset_records([_record(gold_evidence_ids=[])])


def test_dataset_validation_rejects_duplicate_ids_and_bad_snapshot_hashes():
    with pytest.raises(ValueError, match="duplicate"):
        validate_dataset_records([_record(), _record()])

    with pytest.raises(ValueError, match="snapshot_sha256"):
        validate_dataset_records([_record(documents=[{"document_id": "doc-1", "snapshot_sha256": "bad"}])])


def test_dataset_validation_rejects_malformed_lists_and_secret_like_values():
    with pytest.raises(ValueError, match="gold_evidence_ids must be a list"):
        validate_dataset_records([_record(gold_evidence_ids="doc-1:chunk-1")])

    with pytest.raises(ValueError, match="secret-like"):
        validate_dataset_records([_record(gold_answer="sk-or-v1-012345678901234567890123")])
