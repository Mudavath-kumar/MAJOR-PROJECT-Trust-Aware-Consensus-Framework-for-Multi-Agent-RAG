import json

import pytest

from experiments.corpus import build_corpus_manifest


def test_corpus_manifest_has_stable_hashes_and_evidence_ids(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("Alpha beta gamma. " * 250, encoding="utf-8")

    first_path = tmp_path / "manifest-one.json"
    second_path = tmp_path / "manifest-two.json"
    first = build_corpus_manifest([source], first_path, dataset_version="test-v1")
    second = build_corpus_manifest([source], second_path, dataset_version="test-v1")

    assert first == second
    assert json.loads(first_path.read_text(encoding="utf-8")) == first
    document = first["sources"][0]
    assert len(document["snapshot_sha256"]) == 64
    assert document["chunks"]
    assert document["chunks"][0]["evidence_id"].startswith(f"{document['document_id']}:")


def test_corpus_manifest_rejects_missing_sources(tmp_path):
    with pytest.raises(FileNotFoundError):
        build_corpus_manifest([tmp_path / "missing.md"], tmp_path / "manifest.json", "test-v1")
