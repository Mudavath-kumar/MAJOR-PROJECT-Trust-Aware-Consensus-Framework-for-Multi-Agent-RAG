"""Run the six reviewed paper variants and render their comparison tables."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Callable

from .corpus import load_corpus_manifest
from .report import render_comparison_report
from .run_benchmark import PAPER_COUNTS, run_benchmark
from .runner import load_and_validate_config, load_jsonl, validate_dataset_records


VARIANT_CONFIGS = (
    "baseline-rag",
    "reranked-rag",
    "rag-verification",
    "multi-agent-rag",
    "trustrag-no-external",
    "trustrag",
)
CONFIG_DIR = Path(__file__).parent / "configs"
SHARED_CONFIG_FIELDS = ("dataset_version", "model", "embedding_model", "temperature", "seed")


def run_paper_matrix(
    dataset_path: str | Path,
    manifest_path: str | Path,
    output_dir: str | Path,
    *,
    benchmark_runner: Callable[..., Path] | None = None,
    report_renderer: Callable[..., dict] | None = None,
) -> Path:
    """Preflight once, run every paper variant, then write report artifacts.

    The destination must be new or empty; prior experiment artifacts are never
    overwritten. Dataset review/composition and all six configurations are
    checked before the first provider call.
    """
    dataset_path = Path(dataset_path)
    manifest_path = Path(manifest_path)
    output_path = Path(output_dir)
    if output_path.exists() and (
        not output_path.is_dir() or any(output_path.iterdir())
    ):
        raise FileExistsError(f"output path is not a new or empty directory: {output_path}")

    manifest = load_corpus_manifest(manifest_path)
    dataset = validate_dataset_records(
        load_jsonl(dataset_path),
        paper_mode=True,
        manifest=manifest,
        expected_counts=PAPER_COUNTS,
    )
    configs = [
        (variant, CONFIG_DIR / f"{variant}.json", load_and_validate_config(CONFIG_DIR / f"{variant}.json"))
        for variant in VARIANT_CONFIGS
    ]
    for variant, _path, config in configs:
        if config.get("name") != variant:
            raise ValueError(f"variant config name does not match filename: {variant}")
        if config["dataset_version"] != manifest.get("dataset_version"):
            raise ValueError(f"variant {variant} dataset version does not match the corpus manifest")
    for field in SHARED_CONFIG_FIELDS:
        if len({config.get(field) for _variant, _path, config in configs}) != 1:
            raise ValueError(f"paper variants must share {field}")
    if len(dataset) != sum(PAPER_COUNTS.values()):
        raise ValueError("reviewed dataset size does not match the required paper composition")

    output_path.mkdir(parents=True, exist_ok=True)
    execute = benchmark_runner or run_benchmark
    render = report_renderer or render_comparison_report
    run_dirs = []
    for variant, config_path, _config in configs:
        run_dir = output_path / variant
        run_dirs.append(
            execute(
                config_path,
                dataset_path,
                manifest_path,
                run_dir,
                paper_mode=True,
            )
        )
    report_path = output_path / "report"
    render(run_dirs, report_path, baseline="baseline-rag")
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    print(run_paper_matrix(args.dataset, args.manifest, args.output_dir))


if __name__ == "__main__":
    main()
