import json
import hashlib

import pytest

from experiments.metrics import calculate_metrics
from experiments.report import render_comparison_report


def _record(record_id, answer, score):
    return {
        "id": record_id,
        "answer_type": "answerable",
        "gold_answer": "Paris",
        "gold_evidence_ids": ["doc:chunk-1"],
        "predicted_answer": answer,
        "retrieved_evidence_ids": ["doc:chunk-1"],
        "predicted_evidence_ids": ["doc:chunk-1"],
        "status": "answer",
        "decision_score": score,
        "claims": [{"supported": answer == "Paris", "evidence_ids": ["doc:chunk-1"]}],
        "latency_ms": 100 if answer == "Paris" else 200,
        "llm_calls": 1 if answer == "Paris" else 4,
        "verification_calls": 0 if answer == "Paris" else 1,
        "retrieval_calls": 1,
    }


def _write_run(tmp_path, name, system, records, paper_eligible=True, manifest_extra=None):
    run_dir = tmp_path / name
    run_dir.mkdir()
    (run_dir / "config.json").write_text(json.dumps({"name": name, "system": system}), encoding="utf-8")
    predictions_text = "\n".join(json.dumps(record) for record in records) + "\n"
    (run_dir / "predictions.jsonl").write_text(predictions_text, encoding="utf-8")
    (run_dir / "predictions-input.jsonl").write_text(predictions_text, encoding="utf-8")
    (run_dir / "metrics.json").write_text(json.dumps(calculate_metrics(records, k=5)), encoding="utf-8")
    (run_dir / "run-manifest.json").write_text(
        json.dumps({
            "system": system,
            "dataset_version": "trustrag-test-v1",
            "model": "gemini-test-model",
            "embedding_model": "gemini-test-embedding",
            "temperature": 0.1,
            "seed": 42,
            "paper_eligible": paper_eligible,
            "status": "success",
            "dataset_sha256": "dataset-hash",
            "corpus_manifest_sha256": "corpus-hash",
            "predictions_sha256": hashlib.sha256(
                (run_dir / "predictions-input.jsonl").read_bytes()
            ).hexdigest(),
            "llm_successful_provider_models": {"gemini/gemini-test-model": len(records)},
            "sample_count": len(records),
            **(manifest_extra or {}),
        }),
        encoding="utf-8",
    )
    return run_dir


def test_report_renders_both_paper_tables_and_paired_intervals(tmp_path):
    baseline = _write_run(
        tmp_path,
        "baseline",
        "vanilla-rag",
        [_record("q1", "Rome", 0.4), _record("q2", "Rome", 0.4)],
    )
    trustrag = _write_run(
        tmp_path,
        "trustrag",
        "evidence-gated-multi-agent-rag",
        [_record("q1", "Paris", 0.9), _record("q2", "Paris", 0.9)],
    )

    report = render_comparison_report([baseline, trustrag], tmp_path / "report", baseline="vanilla-rag")

    assert report["run_count"] == 2
    assert report["report_version"]
    assert report["bootstrap"] == {
        "samples": 2000,
        "seed": 42,
        "confidence": 0.95,
        "method": "answer-type-stratified record bootstrap",
    }
    assert (tmp_path / "report" / "table-ii.csv").exists()
    assert (tmp_path / "report" / "table-ii.tex").exists()
    assert (tmp_path / "report" / "table-iii.csv").exists()
    assert (tmp_path / "report" / "comparison.json").exists()
    assert report["paired_intervals"]["Trust-AwareConsensusRAG"]["TokenF1"]
    table_row = report["tables"]["table_ii"][0]
    assert "UnsafeAcceptanceRate" in table_row
    assert "GoldEvidenceCitationRate" in table_row
    assert "ExactMatch" in table_row
    assert "CitationPrecision" in table_row
    assert "CitationRecall" in table_row
    assert "SelectiveRisk" in table_row
    assert "DecisionScoreECE" in table_row
    assert "Groundedness" not in table_row
    assert "HallucinationRate" not in table_row
    assert "TypedVerificationRate" in report["tables"]["table_iii"][0]
    assert report["tables"]["table_iii"][0]["CostMeanUSD"] == "N/A"
    assert "HallucinationRate" not in report["tables"]["table_ii"][0]
    assert report["tables"]["table_ii"][0]["VerifierRejectedClaimRate"] == "N/A"
    assert report["tables"]["table_iii"][0]["CostMeanUSD"] == "N/A"
    assert any("human-labelled hallucination" in note for note in report["interpretation_notes"])
    assert any("costmeanusd is n/a" in note.casefold() for note in report["interpretation_notes"])
    assert any("paired system-minus-baseline" in note for note in report["interpretation_notes"])


def test_report_renders_answer_type_metrics_with_real_denominators(tmp_path):
    answerable = _record("q1", "Paris", 0.9)
    unanswerable = _record("q2", "", 0.1)
    unanswerable.update(
        answer_type="unanswerable",
        gold_answer="",
        gold_evidence_ids=[],
        predicted_evidence_ids=[],
        status="abstain",
        claims=[],
    )
    conflicting = _record("q3", "Paris", 0.4)
    conflicting.update(
        answer_type="conflicting",
        gold_answer="Paris",
        status="abstain",
        predicted_answer="",
        predicted_evidence_ids=[],
    )
    injection = _record("q4", "Paris", 0.9)
    injection["answer_type"] = "prompt_injection"
    records = [answerable, unanswerable, conflicting, injection]
    baseline = _write_run(tmp_path, "baseline", "vanilla-rag", records)
    report = render_comparison_report([baseline], tmp_path / "report", baseline="vanilla-rag")

    category_rows = report["category_results"]
    answer_row = next(
        row for row in category_rows
        if row["AnswerType"] == "answerable" and row["Metric"] == "ExactMatch"
    )
    unanswerable_row = next(
        row for row in category_rows
        if row["AnswerType"] == "unanswerable" and row["Metric"] == "AbstentionAccuracy"
    )
    conflict_row = next(
        row for row in category_rows
        if row["AnswerType"] == "conflicting" and row["Metric"] == "AbstentionAccuracy"
    )
    injection_row = next(
        row for row in category_rows
        if row["AnswerType"] == "prompt_injection" and row["Metric"] == "InjectionTaskSuccessRate"
    )

    assert answer_row["N"] == 1 and answer_row["MetricDenominator"] == 1
    assert answer_row["Value"].startswith("1.000")
    assert unanswerable_row["Value"].startswith("1.000")
    assert conflict_row["Value"].startswith("1.000")
    assert injection_row["Value"].startswith("1.000")
    assert (tmp_path / "report" / "category-results.csv").exists()
    assert (tmp_path / "report" / "category-results.json").exists()
    assert (tmp_path / "report" / "category-results.tex").exists()


def test_report_rejects_runs_from_different_dataset_snapshots(tmp_path):
    baseline = _write_run(tmp_path, "baseline", "vanilla-rag", [_record("q1", "Rome", 0.4)])
    trustrag = _write_run(
        tmp_path,
        "trustrag",
        "evidence-gated-multi-agent-rag",
        [_record("q1", "Paris", 0.9)],
        manifest_extra={"corpus_manifest_sha256": "different-corpus"},
    )

    with pytest.raises(ValueError, match="same dataset and corpus"):
        render_comparison_report([baseline, trustrag], tmp_path / "report", baseline="vanilla-rag")


def test_report_rejects_smoke_runs(tmp_path):
    smoke = _write_run(
        tmp_path,
        "smoke",
        "vanilla-rag",
        [_record("q1", "Paris", 0.9)],
        paper_eligible=False,
    )

    with pytest.raises(ValueError, match="paper-eligible"):
        render_comparison_report([smoke], tmp_path / "report", baseline="vanilla-rag")


def test_report_can_label_exploratory_runs_as_provisional(tmp_path):
    run = _write_run(
        tmp_path,
        "exploratory",
        "vanilla-rag",
        [_record("q1", "Paris", 0.9)],
        paper_eligible=False,
        manifest_extra={"run_mode": "exploratory", "raw_outputs_retained": True},
    )

    report = render_comparison_report(
        [run], tmp_path / "provisional-report", baseline="vanilla-rag", allow_provisional=True
    )

    assert report["paper_eligible"] is False
    assert report["run_mode"] == "exploratory-provisional"
    assert any("human review is pending" in note.casefold() for note in report["interpretation_notes"])


def test_report_rejects_metrics_that_do_not_match_predictions(tmp_path):
    run = _write_run(tmp_path, "baseline", "vanilla-rag", [_record("q1", "Paris", 0.9)])
    (run / "metrics.json").write_text(json.dumps({"sample_count": 999}), encoding="utf-8")

    with pytest.raises(ValueError, match="metrics do not match predictions"):
        render_comparison_report([run], tmp_path / "report", baseline="vanilla-rag")


def test_report_rejects_tampered_prediction_input(tmp_path):
    run = _write_run(tmp_path, "baseline", "vanilla-rag", [_record("q1", "Paris", 0.9)])
    with (run / "predictions-input.jsonl").open("a", encoding="utf-8") as handle:
        handle.write("{}\n")

    with pytest.raises(ValueError, match="prediction input hash"):
        render_comparison_report([run], tmp_path / "report", baseline="vanilla-rag")


def test_report_refuses_to_overwrite_existing_output(tmp_path):
    run = _write_run(tmp_path, "baseline", "vanilla-rag", [_record("q1", "Paris", 0.9)])
    output = tmp_path / "report"
    output.mkdir()
    sentinel = output / "keep.txt"
    sentinel.write_text("prior results", encoding="utf-8")

    with pytest.raises(FileExistsError, match="not empty"):
        render_comparison_report([run], output, baseline="vanilla-rag")

    assert sentinel.read_text(encoding="utf-8") == "prior results"
