"""Deterministic confidence intervals for paper metrics."""

from __future__ import annotations

from random import Random
from typing import Any, Sequence

from .metrics import _percentile, calculate_metrics


def _metric_value(metrics: dict[str, Any], metric_name: str) -> float | None:
    value: Any = metrics
    for component in metric_name.split("."):
        if value is None:
            return None
        if not isinstance(value, dict) or component not in value:
            raise ValueError(f"unknown metric path: {metric_name}")
        value = value[component]
    if value is None:
        return None
    if not isinstance(value, (int, float)):
        raise ValueError(f"metric {metric_name} is not scalar")
    return float(value)


def bootstrap_metric_ci(
    records: Sequence[dict[str, Any]],
    metric_name: str,
    *,
    k: int = 5,
    seed: int = 42,
    samples: int = 2000,
    confidence: float = 0.95,
) -> tuple[float, float]:
    """Return a stratified record-resampling CI for one scalar metric."""
    interval = bootstrap_metrics_ci(
        records,
        [metric_name],
        k=k,
        seed=seed,
        samples=samples,
        confidence=confidence,
    )[metric_name]
    if interval is None:
        raise ValueError(f"metric {metric_name} is unavailable for these records")
    return interval


def bootstrap_metrics_ci(
    records: Sequence[dict[str, Any]],
    metric_names: Sequence[str],
    *,
    k: int = 5,
    seed: int = 42,
    samples: int = 2000,
    confidence: float = 0.95,
) -> dict[str, tuple[float, float] | None]:
    """Calculate multiple stratified CIs in one pass over the bootstrap samples."""
    if not records:
        raise ValueError("bootstrap records must be non-empty")
    if samples <= 0 or not 0 < confidence < 1:
        raise ValueError("samples must be positive and confidence must be between 0 and 1")
    if not metric_names:
        raise ValueError("at least one metric is required")

    strata: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        strata.setdefault(str(record["answer_type"]), []).append(record)
    rng = Random(seed)
    values = {name: [] for name in metric_names}
    for _ in range(samples):
        resampled = [
            group[rng.randrange(len(group))]
            for _, group in sorted(strata.items())
            for _ in group
        ]
        metrics = calculate_metrics(resampled, k=k)
        for name in metric_names:
            value = _metric_value(metrics, name)
            if value is not None:
                values[name].append(value)
    alpha = (1 - confidence) / 2
    return {
        name: (
            (_percentile(metric_values, alpha), _percentile(metric_values, 1 - alpha))
            if metric_values
            else None
        )
        for name, metric_values in values.items()
    }


def paired_metric_ci(
    first: Sequence[dict[str, Any]],
    second: Sequence[dict[str, Any]],
    metric_name: str,
    *,
    k: int = 5,
    seed: int = 42,
    samples: int = 2000,
    confidence: float = 0.95,
) -> tuple[float, float]:
    """Return a paired CI for ``first - second`` on matching question IDs."""
    return paired_metrics_ci(
        first,
        second,
        [metric_name],
        k=k,
        seed=seed,
        samples=samples,
        confidence=confidence,
    )[metric_name]


def paired_metrics_ci(
    first: Sequence[dict[str, Any]],
    second: Sequence[dict[str, Any]],
    metric_names: Sequence[str],
    *,
    k: int = 5,
    seed: int = 42,
    samples: int = 2000,
    confidence: float = 0.95,
) -> dict[str, tuple[float, float] | None]:
    """Resample matched records, preserving answer-type strata, and recompute metrics."""
    first_by_id = {str(record.get("id", "")): record for record in first}
    second_by_id = {str(record.get("id", "")): record for record in second}
    if not first_by_id or set(first_by_id) != set(second_by_id):
        raise ValueError("paired records must contain the same non-empty IDs")
    if len(first_by_id) != len(first) or len(second_by_id) != len(second):
        raise ValueError("paired records must not contain duplicate IDs")
    if samples <= 0 or not 0 < confidence < 1:
        raise ValueError("samples must be positive and confidence must be between 0 and 1")
    if not metric_names:
        raise ValueError("at least one metric is required")

    strata: dict[str, list[str]] = {}
    for record_id, first_record in first_by_id.items():
        first_type = str(first_record.get("answer_type", ""))
        second_type = str(second_by_id[record_id].get("answer_type", ""))
        if first_type != second_type:
            raise ValueError(f"paired record {record_id} has mismatched answer_type labels")
        for field in ("dataset_version", "gold_answer", "gold_evidence_ids", "documents"):
            if first_record.get(field) != second_by_id[record_id].get(field):
                raise ValueError(f"paired record {record_id} has mismatched {field} labels")
        strata.setdefault(first_type, []).append(record_id)

    rng = Random(seed)
    differences = {name: [] for name in metric_names}
    for _ in range(samples):
        sampled_ids = [
            group[rng.randrange(len(group))]
            for _, group in sorted(strata.items())
            for _ in group
        ]
        first_metrics = calculate_metrics([first_by_id[record_id] for record_id in sampled_ids], k=k)
        second_metrics = calculate_metrics([second_by_id[record_id] for record_id in sampled_ids], k=k)
        for name in metric_names:
            first_value = _metric_value(first_metrics, name)
            second_value = _metric_value(second_metrics, name)
            if first_value is not None and second_value is not None:
                differences[name].append(first_value - second_value)

    alpha = (1 - confidence) / 2
    return {
        name: (
            (_percentile(values, alpha), _percentile(values, 1 - alpha))
            if values
            else None
        )
        for name, values in differences.items()
    }
