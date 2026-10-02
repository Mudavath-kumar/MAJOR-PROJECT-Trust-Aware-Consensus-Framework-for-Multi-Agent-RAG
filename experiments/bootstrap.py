"""Deterministic confidence intervals for paper metrics."""

from __future__ import annotations

from random import Random
from typing import Any, Sequence

from .metrics import _percentile, calculate_metrics, paired_bootstrap_ci


def _metric_value(metrics: dict[str, Any], metric_name: str) -> float:
    value: Any = metrics
    for component in metric_name.split("."):
        if not isinstance(value, dict) or component not in value:
            raise ValueError(f"unknown metric path: {metric_name}")
        value = value[component]
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
    """Return a record-resampling CI for one system's scalar metric."""
    if not records:
        raise ValueError("bootstrap records must be non-empty")
    if samples <= 0 or not 0 < confidence < 1:
        raise ValueError("samples must be positive and confidence must be between 0 and 1")
    rng = Random(seed)
    values = []
    for _ in range(samples):
        resampled = [records[rng.randrange(len(records))] for _ in records]
        values.append(_metric_value(calculate_metrics(resampled, k=k), metric_name))
    alpha = (1 - confidence) / 2
    return (_percentile(values, alpha), _percentile(values, 1 - alpha))


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
    first_by_id = {str(record.get("id", "")): record for record in first}
    second_by_id = {str(record.get("id", "")): record for record in second}
    if not first_by_id or set(first_by_id) != set(second_by_id):
        raise ValueError("paired records must contain the same non-empty IDs")
    if len(first_by_id) != len(first) or len(second_by_id) != len(second):
        raise ValueError("paired records must not contain duplicate IDs")
    first_values = [_metric_value(calculate_metrics([first_by_id[record_id]], k=k), metric_name) for record_id in first_by_id]
    second_values = [_metric_value(calculate_metrics([second_by_id[record_id]], k=k), metric_name) for record_id in first_by_id]
    return paired_bootstrap_ci(
        first_values,
        second_values,
        seed=seed,
        samples=samples,
        confidence=confidence,
    )
