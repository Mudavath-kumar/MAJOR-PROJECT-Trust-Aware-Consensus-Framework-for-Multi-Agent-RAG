"""Run all exploratory TrustRAG variants with free-tier Gemini and local embeddings."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ai-service"))

from app.core.config import settings
from app.core import llm_router
from experiments import run_exploratory_matrix as matrix
from experiments.report import render_comparison_report


RUN_DIR = Path(__file__).resolve().parent
DATASET = ROOT / "experiments/runs/candidate-v4-local-minilm-openrouter-20261103/pilot-4.jsonl"
CORPUS_MANIFEST = ROOT / "experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json"
SOURCE_CONFIGS = ROOT / "experiments/configs"
CONFIG_DIR = RUN_DIR / "configs"
OUTPUT_DIR = RUN_DIR / "outputs"
EMBEDDING_CACHE = RUN_DIR / "embedding-cache.jsonl"
SOURCE_EMBEDDING_CACHE = ROOT / "experiments/runs/candidate-v4-local-minilm-openrouter-20261103/output/embedding-cache.jsonl"
MODEL = "gemini-3.6-flash"
VARIANTS = (
    "baseline-rag",
    "reranked-rag",
    "rag-verification",
    "multi-agent-rag",
    "trustrag-no-external",
    "trustrag",
)


def main() -> None:
    if OUTPUT_DIR.exists() and any(OUTPUT_DIR.iterdir()):
        raise FileExistsError(f"refusing to overwrite prior run outputs: {OUTPUT_DIR}")
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("Gemini API key is not configured")

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    for variant in VARIANTS:
        source = SOURCE_CONFIGS / f"{variant}.json"
        config = json.loads(source.read_text(encoding="utf-8"))
        config["model"] = MODEL
        config["embedding_model"] = "sentence-transformers/all-MiniLM-L6-v2"
        (CONFIG_DIR / source.name).write_text(
            json.dumps(config, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )

    if not EMBEDDING_CACHE.exists():
        shutil.copy2(SOURCE_EMBEDDING_CACHE, EMBEDDING_CACHE)
    matrix.CONFIG_DIR = CONFIG_DIR
    matrix.VARIANT_CONFIGS = VARIANTS

    def require_cached_embeddings(texts):
        raise RuntimeError(
            f"embedding cache miss for {len(texts)} texts; refusing a model download"
        )

    matrix._default_embedder = require_cached_embeddings

    # Select only the free-tier Gemini model; an exhausted free quota becomes a
    # recorded failure instead of silently falling back to a paid OpenRouter model.
    settings.LLM_PROVIDER = "auto"
    settings.GEMINI_MODEL = MODEL
    settings.OPENROUTER_API_KEY = ""

    original_call = llm_router.call_llm
    pace_lock = asyncio.Lock()
    next_call_at = 0.0

    async def paced_gemini_call(*args, **kwargs):
        nonlocal next_call_at
        async with pace_lock:
            now = time.monotonic()
            await asyncio.sleep(max(0.0, next_call_at - now))
            next_call_at = time.monotonic() + 7.0
            return await original_call(*args, **kwargs)

    llm_router.call_llm = paced_gemini_call
    failures: list[dict] = []
    started = datetime.now(timezone.utc)

    def run_one(config_path, dataset_path, manifest_path, output_path, **kwargs):
        try:
            return matrix.run_benchmark(
                config_path, dataset_path, manifest_path, output_path, **kwargs
            )
        except Exception as exc:
            path = Path(output_path)
            partial_files = list(path.glob("*.partial.jsonl"))
            completed = 0
            if partial_files:
                completed = sum(
                    1
                    for line in partial_files[0].read_text(encoding="utf-8").splitlines()
                    if line.strip()
                )
            secret_values = [settings.GEMINI_API_KEY, settings.TAVILY_API_KEY]
            message = str(exc)
            for secret in secret_values:
                if secret:
                    message = message.replace(secret, "[redacted]")
            failure = {
                "status": "error",
                "run_mode": "exploratory",
                "paper_eligible": False,
                "model": MODEL,
                "variant": path.name,
                "completed_prediction_count": completed,
                "error_type": type(exc).__name__,
                "error_message": message[:1200],
                "failed_at": datetime.now(timezone.utc).isoformat(),
            }
            path.mkdir(parents=True, exist_ok=True)
            (path / "caught-error-manifest.json").write_text(
                json.dumps(failure, indent=2, sort_keys=True) + "\n", encoding="utf-8"
            )
            failures.append(failure)
            return path

    def render_completed(run_dirs, report_dir, *, baseline, allow_provisional):
        complete = [path for path in run_dirs if (Path(path) / "metrics.json").is_file()]
        if any(Path(path).name == baseline for path in complete):
            return render_comparison_report(
                complete, report_dir, baseline=baseline, allow_provisional=allow_provisional
            )
        return {"status": "no_complete_baseline", "included_runs": []}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = matrix.run_exploratory_matrix(
        DATASET,
        CORPUS_MANIFEST,
        OUTPUT_DIR,
        benchmark_runner=run_one,
        report_renderer=render_completed,
        embedding_cache=EMBEDDING_CACHE,
    )

    run_records = []
    for variant in VARIANTS:
        directory = OUTPUT_DIR / variant
        metrics_path = directory / "metrics.json"
        error_path = directory / "error-manifest.json"
        caught_path = directory / "caught-error-manifest.json"
        run_records.append(
            {
                "variant": variant,
                "status": "completed" if metrics_path.is_file() else "error",
                "metrics_file": str(metrics_path.relative_to(RUN_DIR)) if metrics_path.is_file() else None,
                "error_file": next(
                    (str(p.relative_to(RUN_DIR)) for p in (error_path, caught_path) if p.is_file()),
                    None,
                ),
            }
        )

    manifest = {
        "run_id": RUN_DIR.name,
        "started_at": started.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "provider": "gemini-free-tier",
        "model": MODEL,
        "openrouter_fallback_enabled": False,
        "tavily_key_configured": bool(settings.TAVILY_API_KEY),
        "tavily_free_plan_note": "Conditional Tavily calls use the configured key; no paid upgrade or paid provider is enabled.",
        "dataset": str(DATASET.relative_to(ROOT)),
        "dataset_sha256": hashlib.sha256(DATASET.read_bytes()).hexdigest(),
        "corpus_manifest_sha256": hashlib.sha256(CORPUS_MANIFEST.read_bytes()).hexdigest(),
        "human_review_status": "pending for every pilot record",
        "paper_eligible": False,
        "variants": run_records,
        "caught_failures": failures,
        "report_path": str(Path(report_path).relative_to(ROOT)) if Path(report_path).exists() else None,
    }
    (RUN_DIR / "run-manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
