"""Render paper tables from successful, paper-eligible experiment runs."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
from typing import Any, Sequence

from .bootstrap import bootstrap_metrics_ci, paired_metrics_ci
from .metrics import calculate_metrics


REPORT_VERSION = "trustrag-report-v2"
BOOTSTRAP_SAMPLES = 2000
BOOTSTRAP_SEED = 42
BOOTSTRAP_CONFIDENCE = 0.95


TABLE_II_METRICS = {
    "ExactMatch": "answer_exact_match",
    "TokenF1": "answer_token_f1",
    "Recall@K": "retrieval_recall_at_k",
    "CitationPrecision": "citation_precision",
    "CitationRecall": "citation_recall",
    "GoldEvidenceCitationRate": "grounded_answer_rate",
    "InjectionTaskSuccessRate": "injection_task_success_rate",
    "VerifierRejectedClaimRate": "verifier_rejected_claim_rate",
    "UnsafeAcceptanceRate": "unsafe_acceptance_rate",
    "UnsafeAbstentionRecall": "abstention_coverage",
    "Coverage": "coverage",
    "SelectiveRisk": "selective_risk",
    "DecisionScoreBrier": "brier_score",
    "DecisionScoreECE": "expected_calibration_error",
}
TABLE_III_METRICS = {
    "LatencyMeanMs": "latency_ms.mean",
    "LatencyP50Ms": "latency_ms.p50",
    "LatencyP95Ms": "latency_ms.p95",
    "LLMCalls/Query": "llm_calls_per_query",
    "TypedVerificationRate": "verification_rate",
    "RetrievalCalls/Query": "retrieval_calls_per_query",
    "CostMeanUSD": "cost_usd.mean",
}
OPERATIONAL_CATEGORY_METRICS = (
    ("LatencyMeanMs", "latency_ms.mean", "sample_count", "queries"),
    ("LatencyP50Ms", "latency_ms.p50", "sample_count", "queries"),
    ("LatencyP95Ms", "latency_ms.p95", "sample_count", "queries"),
    ("LLMCalls/Query", "llm_calls_per_query", "sample_count", "queries"),
    ("TypedVerificationRate", "verification_rate", "sample_count", "queries"),
    ("RetrievalCalls/Query", "retrieval_calls_per_query", "sample_count", "queries"),
    ("CostMeanUSD", "cost_usd.mean", "sample_count", "queries"),
)
CATEGORY_QUALITY_METRICS = {
    "answerable": (
        ("ExactMatch", "answer_exact_match", "answerable", "queries"),
        ("TokenF1", "answer_token_f1", "answerable", "queries"),
        ("Recall@5", "retrieval_recall_at_k", "answerable", "queries"),
        ("CitationPrecision", "citation_precision", "answerable", "queries"),
        ("CitationRecall", "citation_recall", "answerable", "queries"),
        ("Coverage", "coverage", "sample_count", "queries"),
        ("SelectiveRisk", "selective_risk", "accepted_answerable", "accepted queries"),
    ),
    "unanswerable": (
        ("AbstentionAccuracy", "abstention_coverage", "unsafe", "queries"),
        ("UnsafeAcceptanceRate", "unsafe_acceptance_rate", "unsafe", "queries"),
        ("Coverage", "coverage", "sample_count", "queries"),
    ),
    "conflicting": (
        ("AbstentionAccuracy", "abstention_coverage", "unsafe", "queries"),
        ("UnsafeAcceptanceRate", "unsafe_acceptance_rate", "unsafe", "queries"),
        ("Coverage", "coverage", "sample_count", "queries"),
    ),
    "prompt_injection": (
        ("InjectionTaskSuccessRate", "injection_task_success_rate", "injection", "queries"),
        ("ExactMatch", "answer_exact_match", "answerable", "queries"),
        ("TokenF1", "answer_token_f1", "answerable", "queries"),
        ("Recall@5", "retrieval_recall_at_k", "answerable", "queries"),
        ("CitationPrecision", "citation_precision", "answerable", "queries"),
        ("CitationRecall", "citation_recall", "answerable", "queries"),
        ("Coverage", "coverage", "sample_count", "queries"),
    ),
}
PAIR_METRICS = {
    **TABLE_II_METRICS,
    **TABLE_III_METRICS,
}
DENOMINATOR_COLUMNS = (
    "N",
    "N_answerable",
    "N_injection",
    "N_unsafe",
    "N_accepted_answerable",
    "N_gold_evidence",
    "N_cited_evidence",
    "N_claims",
    "N_verified_claims",
)
LABELS = {
    "baseline-rag": "StandardRAG",
    "vanilla-rag": "StandardRAG",
    "reranked-rag": "RerankedRAG",
    "vanilla-rag-with-reranking": "RerankedRAG",
    "rag-verification": "RAG+Verification",
    "single-pass-rag-with-typed-verification": "RAG+Verification",
    "multi-agent-rag": "FixedMulti-AgentRAG",
    "multi-agent-without-decision-gate": "FixedMulti-AgentRAG",
    "trustrag": "Trust-AwareConsensusRAG",
    "evidence-gated-multi-agent-rag": "Trust-AwareConsensusRAG",
    "trustrag-no-external": "TrustRAG without external verification",
}


def _read_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def _metric_value(metrics: dict[str, Any], name: str) -> float | None:
    current: Any = metrics
    for part in name.split("."):
        if current is None:
            return None
        if not isinstance(current, dict) or part not in current:
            raise ValueError(f"run metrics missing {name}")
        current = current[part]
    if current is None:
        return None
    if not isinstance(current, (int, float)):
        raise ValueError(f"run metric {name} is not scalar")
    return float(current)


def _label(config: dict[str, Any], manifest: dict[str, Any]) -> str:
    for candidate in (config.get("name"), config.get("system"), manifest.get("system")):
        if candidate in LABELS:
            return LABELS[candidate]
    raise ValueError(f"run has no known paper variant: {config.get('name') or config.get('system')}")


def _load_run(run_dir: Path, *, allow_provisional: bool = False) -> dict[str, Any]:
    manifest = _read_json(run_dir / "run-manifest.json")
    paper_eligible = manifest.get("paper_eligible") is True
    provisional = (
        allow_provisional
        and manifest.get("status", "success") == "success"
        and manifest.get("run_mode") == "exploratory"
        and manifest.get("raw_outputs_retained") is True
        and not paper_eligible
    )
    if manifest.get("status", "success") != "success" or not (paper_eligible or provisional):
        eligibility = "paper-eligible or explicitly allowed exploratory" if allow_provisional else "paper-eligible"
        raise ValueError(f"run {run_dir} is not {eligibility}")
    config = _read_json(run_dir / "config.json")
    predictions_input_path = run_dir / "predictions-input.jsonl"
    expected_predictions_hash = manifest.get("predictions_sha256")
    if not predictions_input_path.is_file() or not isinstance(expected_predictions_hash, str):
        raise ValueError(f"paper run {run_dir} is missing its hashed prediction input")
    actual_predictions_hash = hashlib.sha256(predictions_input_path.read_bytes()).hexdigest()
    if actual_predictions_hash != expected_predictions_hash:
        raise ValueError(f"run {run_dir} prediction input hash does not match its manifest")
    predictions = [
        json.loads(line)
        for line in (run_dir / "predictions.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not predictions:
        raise ValueError(f"run {run_dir} contains no predictions")
    if manifest.get("sample_count") != len(predictions):
        raise ValueError(f"run {run_dir} sample count does not match predictions")
    metrics = _read_json(run_dir / "metrics.json")
    recomputed_metrics = calculate_metrics(
        predictions, k=int((config.get("retrieval") or {}).get("top_k", 5))
    )
    if metrics != recomputed_metrics:
        raise ValueError(f"run {run_dir} metrics do not match predictions")
    return {
        "dir": str(run_dir),
        "manifest": manifest,
        "config": config,
        "metrics": metrics,
        "predictions": predictions,
        "label": _label(config, manifest),
    }


def _format_value(value: float, interval: tuple[float, float] | None) -> str:
    if interval is None:
        return f"{value:.3f} [CI unavailable]"
    return f"{value:.3f} [{interval[0]:.3f}, {interval[1]:.3f}]"


def _write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def _tex_escape(value: Any) -> str:
    return str(value).replace("\\", "\\textbackslash{}").replace("_", "\\_").replace("%", "\\%")


def _write_tex(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    alignment = "l" + "c" * (len(columns) - 1)
    row_end = r" \\"
    lines = [
        f"\\begin{{tabular}}{{{alignment}}}",
        " ".join(_tex_escape(column) for column in columns) + row_end,
        r"\hline",
    ]
    for row in rows:
        lines.append(" & ".join(_tex_escape(row[column]) for column in columns) + row_end)
    lines.append(r"\end{tabular}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_resized_tex(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    temporary = path.with_suffix(".table.tmp")
    _write_tex(temporary, rows, columns)
    body = temporary.read_text(encoding="utf-8")
    temporary.unlink()
    path.write_text(
        "\\resizebox{\\textwidth}{!}{%\n" + body + "}\n",
        encoding="utf-8",
    )


def _single_intervals(
    run: dict[str, Any], metric_map: dict[str, str]
) -> dict[str, tuple[float, float] | None]:
    available = {
        column: metric
        for column, metric in metric_map.items()
        if _metric_value(run["metrics"], metric) is not None
    }
    if not available:
        return {column: None for column in metric_map}
    top_k = int((run.get("config", {}).get("retrieval") or {}).get("top_k", 5))
    intervals = bootstrap_metrics_ci(
        run["predictions"],
        list(available.values()),
        k=top_k,
        samples=BOOTSTRAP_SAMPLES,
        seed=BOOTSTRAP_SEED,
        confidence=BOOTSTRAP_CONFIDENCE,
    )
    return {column: intervals.get(metric) for column, metric in metric_map.items()}


def _format_metric(
    metrics: dict[str, Any], name: str, interval: tuple[float, float] | None
) -> str:
    value = _metric_value(metrics, name)
    return "N/A" if value is None else _format_value(value, interval)


def render_comparison_report(
    run_dirs: Sequence[str | Path],
    output_dir: str | Path,
    *,
    baseline: str,
    allow_provisional: bool = False,
) -> dict[str, Any]:
    if not run_dirs:
        raise ValueError("at least one run is required")
    output = Path(output_dir)
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise FileExistsError(f"report output directory is not empty: {output}")
    runs = [_load_run(Path(run_dir), allow_provisional=allow_provisional) for run_dir in run_dirs]
    paper_eligibility = {run["manifest"].get("paper_eligible") is True for run in runs}
    if len(paper_eligibility) != 1:
        raise ValueError("comparison cannot mix paper-eligible and exploratory runs")
    paper_eligible = next(iter(paper_eligibility))
    labels = [run["label"] for run in runs]
    if len(labels) != len(set(labels)):
        raise ValueError("paper comparison cannot include duplicate variant labels")
    fingerprints = {
        (
            run["manifest"].get("dataset_sha256"),
            run["manifest"].get("corpus_manifest_sha256"),
        )
        for run in runs
    }
    if len(fingerprints) != 1 or any(not value for value in next(iter(fingerprints))):
        raise ValueError("paper comparisons require the same dataset and corpus fingerprints")
    for field in ("dataset_version", "model", "embedding_model", "temperature", "seed"):
        values = {run["manifest"].get(field) for run in runs}
        if len(values) != 1 or not next(iter(values)):
            raise ValueError(f"paper comparisons require a shared {field}")
    review_protocols = {run["manifest"].get("review_protocol", "unspecified") for run in runs}
    reviewer_counts = {run["manifest"].get("human_reviewer_count", 0) for run in runs}
    review_audits = {run["manifest"].get("review_audit_sha256") for run in runs}
    if len(review_protocols) != 1 or len(reviewer_counts) != 1 or len(review_audits) != 1:
        raise ValueError("paper comparisons require shared dataset review protocol metadata")
    review_protocol = next(iter(review_protocols))
    human_reviewer_count = next(iter(reviewer_counts))
    review_audit_sha256 = next(iter(review_audits))
    actual_model_sets = [
        frozenset(
            model
            for model, count in (run["manifest"].get("llm_successful_provider_models") or {}).items()
            if count > 0
        )
        for run in runs
    ]
    if any(not models for models in actual_model_sets) or len(set(actual_model_sets)) != 1:
        raise ValueError("paper comparisons require the same successful provider and model")
    baseline_run = next(
        (
            run
            for run in runs
            if run["config"].get("name") == baseline or run["config"].get("system") == baseline
        ),
        None,
    )
    if baseline_run is None:
        raise ValueError(f"baseline run {baseline} was not provided")

    output.mkdir(parents=True, exist_ok=True)
    table_ii_rows: list[dict[str, Any]] = []
    table_iii_rows: list[dict[str, Any]] = []
    category_rows: list[dict[str, Any]] = []
    interval_sidecar: dict[str, Any] = {}
    for run in runs:
        intervals_ii = _single_intervals(run, TABLE_II_METRICS)
        intervals_iii = _single_intervals(run, TABLE_III_METRICS)
        interval_sidecar[run["label"]] = {
            "table_ii": {key: list(value) if value is not None else None for key, value in intervals_ii.items()},
            "table_iii": {key: list(value) if value is not None else None for key, value in intervals_iii.items()},
        }
        table_ii_rows.append(
            {
                "Model": run["label"],
                "ReviewProtocol": review_protocol,
                "HumanReviewers": human_reviewer_count,
                "N": run["metrics"].get("sample_count", len(run["predictions"])),
                "N_answerable": run["metrics"]["denominators"]["answerable"],
                "N_injection": run["metrics"]["denominators"]["injection"],
                "N_unsafe": run["metrics"]["denominators"]["unsafe"],
                "N_accepted_answerable": run["metrics"]["denominators"]["accepted_answerable"],
                "N_gold_evidence": run["metrics"]["denominators"]["gold_evidence"],
                "N_cited_evidence": run["metrics"]["denominators"]["cited_evidence"],
                "N_claims": run["metrics"]["denominators"]["claims"],
                "N_verified_claims": run["metrics"]["denominators"]["verified_claims"],
                **{
                    column: _format_metric(run["metrics"], metric, intervals_ii[column])
                    for column, metric in TABLE_II_METRICS.items()
                },
            }
        )
        table_iii_rows.append(
            {
                "Model": run["label"],
                "ReviewProtocol": review_protocol,
                "HumanReviewers": human_reviewer_count,
                "N": run["metrics"].get("sample_count", len(run["predictions"])),
                "N_answerable": run["metrics"]["denominators"]["answerable"],
                "N_injection": run["metrics"]["denominators"]["injection"],
                "N_unsafe": run["metrics"]["denominators"]["unsafe"],
                "N_accepted_answerable": run["metrics"]["denominators"]["accepted_answerable"],
                "N_gold_evidence": run["metrics"]["denominators"]["gold_evidence"],
                "N_cited_evidence": run["metrics"]["denominators"]["cited_evidence"],
                "N_claims": run["metrics"]["denominators"]["claims"],
                "N_verified_claims": run["metrics"]["denominators"]["verified_claims"],
                **{
                    column: _format_metric(run["metrics"], metric, intervals_iii[column])
                    for column, metric in TABLE_III_METRICS.items()
                },
            }
        )
        for answer_type, metric_specs in CATEGORY_QUALITY_METRICS.items():
            category_predictions = [
                item for item in run["predictions"] if item["answer_type"] == answer_type
            ]
            if not category_predictions:
                continue
            top_k = int((run["config"].get("retrieval") or {}).get("top_k", 5))
            category_metrics = calculate_metrics(category_predictions, k=top_k)
            metric_specs = (*metric_specs, *OPERATIONAL_CATEGORY_METRICS)
            interval_metrics = {
                label: metric
                for label, metric, _denominator, _unit in metric_specs
                if _metric_value(category_metrics, metric) is not None
            }
            category_intervals = (
                bootstrap_metrics_ci(
                    category_predictions,
                    list(interval_metrics.values()),
                    k=top_k,
                    seed=BOOTSTRAP_SEED,
                    samples=BOOTSTRAP_SAMPLES,
                    confidence=BOOTSTRAP_CONFIDENCE,
                )
                if interval_metrics
                else {}
            )
            for label, metric, denominator_key, denominator_unit in metric_specs:
                value = _metric_value(category_metrics, metric)
                interval = category_intervals.get(metric)
                denominator = category_metrics["denominators"].get(denominator_key)
                category_rows.append(
                    {
                        "Model": run["label"],
                        "AnswerType": answer_type,
                        "N": len(category_predictions),
                        "Metric": label,
                        "Value": "N/A" if value is None else _format_value(value, interval),
                        "MetricDenominator": denominator,
                        "DenominatorUnit": denominator_unit,
                    }
                )

    paired: dict[str, Any] = {}
    baseline_records = baseline_run["predictions"]
    for run in runs:
        if run is baseline_run:
            continue
        comparable_metrics = {
            column: metric
            for column, metric in PAIR_METRICS.items()
            if _metric_value(run["metrics"], metric) is not None
            and _metric_value(baseline_run["metrics"], metric) is not None
        }
        intervals = paired_metrics_ci(
            run["predictions"],
            baseline_records,
            list(comparable_metrics.values()),
            k=int((run["config"].get("retrieval") or {}).get("top_k", 5)),
            samples=BOOTSTRAP_SAMPLES,
            seed=BOOTSTRAP_SEED,
            confidence=BOOTSTRAP_CONFIDENCE,
        )
        paired[run["label"]] = {
            metric_name: list(intervals[metric_path]) if intervals.get(metric_path) is not None else None
            for metric_name, metric_path in comparable_metrics.items()
        }

    columns_ii = ["Model", "ReviewProtocol", "HumanReviewers", *DENOMINATOR_COLUMNS, *TABLE_II_METRICS]
    columns_iii = ["Model", "ReviewProtocol", "HumanReviewers", *DENOMINATOR_COLUMNS, *TABLE_III_METRICS]
    _write_csv(output / "table-ii.csv", table_ii_rows, columns_ii)
    _write_tex(output / "table-ii.tex", table_ii_rows, columns_ii)
    _write_csv(output / "table-iii.csv", table_iii_rows, columns_iii)
    _write_tex(output / "table-iii.tex", table_iii_rows, columns_iii)
    category_columns = [
        "Model",
        "AnswerType",
        "N",
        "Metric",
        "Value",
        "MetricDenominator",
        "DenominatorUnit",
    ]
    _write_csv(output / "category-results.csv", category_rows, category_columns)
    _write_resized_tex(output / "category-results.tex", category_rows, category_columns)
    (output / "category-results.json").write_text(
        json.dumps(category_rows, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    report = {
        "report_version": REPORT_VERSION,
        "paper_eligible": paper_eligible,
        "run_mode": "paper" if paper_eligible else "exploratory-provisional",
        "bootstrap": {
            "samples": BOOTSTRAP_SAMPLES,
            "seed": BOOTSTRAP_SEED,
            "confidence": BOOTSTRAP_CONFIDENCE,
            "method": "answer-type-stratified record bootstrap",
        },
        "run_count": len(runs),
        "baseline": baseline,
        "dataset_review": {
            "protocol": review_protocol,
            "human_reviewer_count": human_reviewer_count,
            "automated_audit_sha256": review_audit_sha256,
        },
        "tables": {
            "table_ii": table_ii_rows,
            "table_iii": table_iii_rows,
            "category_results": category_rows,
        },
        "category_results": category_rows,
        "single_system_intervals": interval_sidecar,
        "paired_intervals": paired,
        "interpretation_notes": [
            "TypedVerificationRate counts queries that invoked the typed claim verifier; it is not external-search coverage.",
            "GoldEvidenceCitationRate measures citation overlap with reviewed gold evidence; it does not establish claim entailment.",
            "Decision-score Brier/ECE compare an operational heuristic with answerability; the score is not a calibrated probability.",
            "A human-labelled hallucination rate is not reported because independent claim-level annotations are absent.",
            "CostMeanUSD is N/A because per-query token usage and provider pricing telemetry are absent.",
            "Table intervals are per-system stratified bootstrap 95% confidence intervals; paired system-minus-baseline intervals are in paired_intervals.",
        ],
    }
    if not paper_eligible:
        report["interpretation_notes"].append(
            "These exploratory results use automated-only dataset review; human review is pending, so they are not paper-eligible findings."
        )
    (output / "comparison.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return report
