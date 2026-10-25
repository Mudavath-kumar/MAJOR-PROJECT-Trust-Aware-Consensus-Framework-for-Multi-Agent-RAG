import json
from pathlib import Path

import pytest

from experiments.corpus import build_corpus_manifest
from experiments.run_matrix import VARIANT_CONFIGS, run_paper_matrix


ANSWER_TYPES = ["answerable"] * 100 + ["unanswerable"] * 50 + ["conflicting"] * 25 + ["prompt_injection"] * 25


def _inputs(tmp_path, *, reviewed):
    source_path = tmp_path / "source.md"
    source_path.write_text("A reviewed test source with enough evidence.", encoding="utf-8")
    manifest_path = tmp_path / "manifest.json"
    manifest = build_corpus_manifest([source_path], manifest_path, "trustrag-v1")
    source = manifest["sources"][0]
    evidence_id = source["chunks"][0]["evidence_id"]
    records = []
    for index, answer_type in enumerate(ANSWER_TYPES):
        requires_answer = answer_type in {"answerable", "prompt_injection"}
        record = {
            "id": f"q-{index:04}",
            "dataset_version": "trustrag-v1",
            "question": f"Question {index}?",
            "answer_type": answer_type,
            "gold_answer": "A reviewed fact." if requires_answer else "",
            "gold_evidence_ids": [evidence_id] if requires_answer else [],
            "documents": [
                {
                    "document_id": source["document_id"],
                    "snapshot_sha256": source["snapshot_sha256"],
                }
            ],
            "review": {
                "reviewer_a": "approved" if reviewed else "pending",
                "reviewer_b": "approved" if reviewed else "pending",
                "resolution": "resolved" if reviewed else "pending",
            },
        }
        records.append(record)
    dataset_path = tmp_path / "dataset.jsonl"
    dataset_path.write_text(
        "".join(json.dumps(record) + "\n" for record in records), encoding="utf-8"
    )
    return dataset_path, manifest_path


def test_paper_matrix_refuses_pending_dataset_before_any_model_run(tmp_path, monkeypatch):
    dataset_path, manifest_path = _inputs(tmp_path, reviewed=False)
    calls = []
    monkeypatch.setattr("experiments.run_matrix.run_benchmark", lambda *args, **kwargs: calls.append(args))

    with pytest.raises(ValueError, match="review"):
        run_paper_matrix(dataset_path, manifest_path, tmp_path / "runs")

    assert calls == []
    assert not (tmp_path / "runs").exists()


def test_paper_matrix_runs_all_six_variants_and_builds_report(tmp_path, monkeypatch):
    dataset_path, manifest_path = _inputs(tmp_path, reviewed=True)
    calls = []
    report_call = {}

    def fake_run(config_path, dataset, manifest, output_dir, *, paper_mode):
        calls.append((config_path.name, Path(output_dir).name, paper_mode))
        Path(output_dir).mkdir(parents=True)
        return Path(output_dir)

    def fake_report(run_dirs, output_dir, *, baseline):
        report_call.update(run_dirs=run_dirs, output_dir=output_dir, baseline=baseline)
        Path(output_dir).mkdir(parents=True)
        return {}

    monkeypatch.setattr("experiments.run_matrix.run_benchmark", fake_run)
    monkeypatch.setattr("experiments.run_matrix.render_comparison_report", fake_report)

    report_path = run_paper_matrix(dataset_path, manifest_path, tmp_path / "runs")

    assert [item[0] for item in calls] == [f"{variant}.json" for variant in VARIANT_CONFIGS]
    assert all(item[2] is True for item in calls)
    assert report_call["baseline"] == "baseline-rag"
    assert len(report_call["run_dirs"]) == 6
    assert report_path == tmp_path / "runs" / "report"
