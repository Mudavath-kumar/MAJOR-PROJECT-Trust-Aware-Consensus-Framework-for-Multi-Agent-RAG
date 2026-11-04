import json
from pathlib import Path

import pytest

from experiments.corpus import build_corpus_manifest
from experiments.run_exploratory_matrix import _MemoizedEmbedder, run_exploratory_matrix


ANSWER_TYPES = ["answerable"] * 100 + ["unanswerable"] * 50 + ["conflicting"] * 25 + ["prompt_injection"] * 25


def _approved_automated_dataset(tmp_path):
    source = tmp_path / "source.md"
    source.write_text("A source with a reviewed test fact.", encoding="utf-8")
    manifest_path = tmp_path / "manifest.json"
    manifest = build_corpus_manifest([source], manifest_path, "trustrag-v1")
    corpus_source = manifest["sources"][0]
    evidence_id = corpus_source["chunks"][0]["evidence_id"]
    records = []
    for index, answer_type in enumerate(ANSWER_TYPES):
        requires_answer = answer_type in {"answerable", "prompt_injection"}
        records.append(
            {
                "id": f"q-{index:04}",
                "dataset_version": "trustrag-v1",
                "question": f"Question {index}?",
                "answer_type": answer_type,
                "gold_answer": "A reviewed test fact." if requires_answer else "",
                "gold_evidence_ids": [evidence_id] if requires_answer else [],
                "documents": [{"document_id": corpus_source["document_id"], "snapshot_sha256": corpus_source["snapshot_sha256"]}],
            }
        )
    for record in records:
        record["human_review_status"] = "pending"
        record["automated_review"] = {"decision": "Approved", "reviewer_type": "automated"}
    path = tmp_path / "dataset.jsonl"
    path.write_text("".join(json.dumps(record) + "\n" for record in records), encoding="utf-8")
    return path, manifest_path


def test_exploratory_matrix_runs_six_variants_and_marks_report_provisional(tmp_path, monkeypatch):
    dataset, manifest = _approved_automated_dataset(tmp_path)
    monkeypatch.setattr(
        "experiments.run_exploratory_matrix._default_embedder",
        lambda texts: [[1.0, 0.0] for _text in texts],
    )
    monkeypatch.setattr("experiments.run_exploratory_matrix.load_corpus_rows", lambda _manifest: [])
    run_calls = []
    report_call = {}

    def fake_run(config_path, dataset_path, manifest_path, output_dir, **kwargs):
        run_calls.append((Path(config_path).stem, kwargs))
        Path(output_dir).mkdir(parents=True)
        return Path(output_dir)

    def fake_report(run_dirs, output_dir, **kwargs):
        report_call.update(run_dirs=run_dirs, output_dir=output_dir, kwargs=kwargs)
        Path(output_dir).mkdir(parents=True)
        return {"paper_eligible": False}

    report_path = run_exploratory_matrix(
        dataset, manifest, tmp_path / "runs", benchmark_runner=fake_run, report_renderer=fake_report
    )

    assert len(run_calls) == 6
    assert all(kwargs["paper_mode"] is False for _, kwargs in run_calls)
    assert all(kwargs["retain_raw_outputs"] is True for _, kwargs in run_calls)
    assert all(callable(kwargs["context_provider"]) for _, kwargs in run_calls)
    assert report_call["kwargs"] == {"baseline": "baseline-rag", "allow_provisional": True}
    assert report_path == tmp_path / "runs" / "report"


def test_memoized_embedder_computes_each_text_once():
    calls = []

    def embed(texts):
        calls.append(list(texts))
        return [[float(len(text)), 1.0] for text in texts]

    cache = _MemoizedEmbedder(embed)

    assert cache(["a", "b"]) == [[1.0, 1.0], [1.0, 1.0]]
    assert cache(["a", "c"]) == [[1.0, 1.0], [1.0, 1.0]]
    assert calls == [["a", "b"], ["c"]]


def test_memoized_embedder_persists_verified_vectors_for_retry(tmp_path):
    cache_path = tmp_path / "embedding-cache.jsonl"
    calls = []

    def embed(texts):
        calls.append(list(texts))
        return [[float(len(text)), 1.0] for text in texts]

    first = _MemoizedEmbedder(embed, cache_path=cache_path, model="gemini-embedding-2")
    assert first(["alpha", "beta"]) == [[5.0, 1.0], [4.0, 1.0]]

    second = _MemoizedEmbedder(
        lambda _texts: pytest.fail("cached vectors should avoid a second provider request"),
        cache_path=cache_path,
        model="gemini-embedding-2",
    )
    assert second(["alpha", "beta"]) == [[5.0, 1.0], [4.0, 1.0]]
    assert calls == [["alpha", "beta"]]


def test_exploratory_matrix_rejects_pending_or_human_ambiguous_rows_before_execution(tmp_path):
    dataset, manifest = _approved_automated_dataset(tmp_path)
    records = [json.loads(line) for line in dataset.read_text(encoding="utf-8").splitlines()]
    records[0]["automated_review"]["decision"] = "Needs Review"
    dataset.write_text("".join(json.dumps(record) + "\n" for record in records), encoding="utf-8")
    calls = []

    with pytest.raises(ValueError, match="automated approval"):
        run_exploratory_matrix(
            dataset,
            manifest,
            tmp_path / "runs",
            benchmark_runner=lambda *args, **kwargs: calls.append(args),
        )

    assert calls == []
    assert not (tmp_path / "runs").exists()


def test_exploratory_matrix_records_embedding_preflight_failure(tmp_path, monkeypatch):
    dataset, manifest_path = _approved_automated_dataset(tmp_path)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    source = manifest["sources"][0]
    monkeypatch.setattr(
        "experiments.run_exploratory_matrix.load_corpus_rows",
        lambda _manifest: [{
            "chunk_id": source["chunks"][0]["evidence_id"],
            "text": "source evidence",
            "metadata": {"document_id": source["document_id"]},
        }],
    )

    def fail_embed(_texts):
        raise RuntimeError("embedding provider returned HTTP 429")

    monkeypatch.setattr("experiments.run_exploratory_matrix._default_embedder", fail_embed)
    output_dir = tmp_path / "failed-runs"

    with pytest.raises(RuntimeError, match="HTTP 429"):
        run_exploratory_matrix(dataset, manifest_path, output_dir)

    failure = json.loads((output_dir / "preflight-error.json").read_text(encoding="utf-8"))
    assert failure["phase"] == "corpus_embedding"
    assert failure["status"] == "error"
    assert failure["paper_eligible"] is False
