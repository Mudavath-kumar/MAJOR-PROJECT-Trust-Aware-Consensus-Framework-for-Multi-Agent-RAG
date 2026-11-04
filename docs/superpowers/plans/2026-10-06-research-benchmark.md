# TrustRAG Research Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a research-only benchmark adapter and reporting workflow that executes five RAG variants over a versioned project-document corpus and produces validated paper tables.

**Architecture:** Keep corpus construction, variant execution, scoring, and reporting as separate modules under `experiments/`. The adapter imports the AI service’s existing chunking, retrieval, agent, and consensus primitives through an explicit research boundary and records a manifest for every run. Dataset review gates paper mode, while smoke mode is available only for plumbing tests.

**Tech Stack:** Python 3, pytest, existing FastAPI AI-service modules, existing Gemini/OpenRouter/Tavily integrations, JSONL, JSON, CSV, and LaTeX table output.

**Spec:** `docs/superpowers/specs/2026-10-06-research-benchmark-design.md`

## Global Constraints

- Use only committed project-owned documents for the initial corpus.
- Keep private source text, provider credentials, and production database URLs out of committed research artifacts.
- Use the same corpus, IDs, retrieval settings, model identifiers, temperature, and seed for every variant.
- Refuse paper mode when review status, evidence IDs, or prediction telemetry is incomplete.
- Never silently substitute Trust-AwareConsensusRAG for another requested variant.
- Preserve the existing uncommitted research-harness changes; do not reset or overwrite them.

---

### Task 1: Corpus snapshot and dataset authoring workflow

**Files:**
- Create: `experiments/corpus.py`
- Create: `experiments/dataset_builder.py`
- Create: `experiments/tests/test_corpus.py`
- Create: `experiments/tests/test_dataset_builder.py`
- Modify: `experiments/runner.py`
- Modify: `experiments/datasets/README.md`

**Interfaces:**
- `build_corpus_manifest(source_paths: Sequence[str | Path], output_path: str | Path, dataset_version: str) -> dict`
- `build_review_template(manifest: dict, output_path: str | Path, record_count: int) -> Path`
- `validate_dataset_records(records, *, paper_mode: bool = False, manifest: dict | None = None) -> list[dict]`

- [x] **Step 1: Write failing tests**

  Test stable source hashes and chunk IDs, rejection of missing sources and
  secret-like text, template review status, and paper-mode rejection of
  pending reviewers or evidence IDs outside the manifest.

- [x] **Step 2: Run the corpus/dataset tests and confirm the expected failures**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests/test_corpus.py experiments/tests/test_dataset_builder.py -q`

- [x] **Step 3: Implement deterministic corpus snapshotting**

  Read the approved source paths as UTF-8, compute SHA-256 over bytes, invoke
  the existing 400/80 chunking contract, and emit only source metadata and
  chunk IDs in the manifest.

- [x] **Step 4: Implement review-template generation and paper-mode validation**

  Generate records with explicit `reviewer_a`, `reviewer_b`, and `resolution`
  states. Extend dataset validation so smoke mode permits pending records but
  paper mode requires `approved` for both reviewers and `resolved` resolution.

- [x] **Step 5: Run the focused tests and the existing experiment suite**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests -q`

### Task 2: Variant execution boundary

**Files:**
- Create: `experiments/variant_runner.py`
- Create: `experiments/tests/test_variant_runner.py`
- Modify: `experiments/configs/*.json`
- Modify: `experiments/README.md`

**Interfaces:**
- `VariantProfile.from_config(config: dict) -> VariantProfile`
- `run_variant_query(profile: VariantProfile, query: str, context: list[dict], credentials: ProviderCredentials) -> PredictionRecord`
- `PredictionRecord.to_dict() -> dict`

- [x] **Step 1: Write failing tests for the five execution contracts**

  Use a deterministic fake provider and fixed context to assert that each
  profile has distinct stage calls, telemetry counts, evidence IDs, and a
  fail-closed error for an unsupported mode.

- [x] **Step 2: Run the focused variant tests and confirm they fail**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests/test_variant_runner.py -q`

- [x] **Step 3: Implement profile parsing and common retrieval**

  Load the existing JSON config, validate its declared mode, retrieve the same
  top-K context, and expose a provider interface so tests never call external
  APIs.

- [x] **Step 4: Implement the five pipelines**

  Implement single-pass generation, hybrid reranking, typed claim
  verification, fixed multi-agent execution, and the existing trust-aware
  consensus path as separate dispatch branches. Each branch must return the
  common prediction schema and count every provider/retrieval/verification
  call.

- [x] **Step 5: Run focused and AI-service tests**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests/test_variant_runner.py ai-service/tests -q`

### Task 3: Corpus-backed benchmark command

**Files:**
- Create: `experiments/run_benchmark.py`
- Create: `experiments/tests/test_run_benchmark.py`
- Modify: `experiments/runner.py`
- Modify: `experiments/README.md`

**Interfaces:**
- `run_benchmark(config_path, dataset_path, manifest_path, output_dir, *, paper_mode: bool) -> Path`
- CLI: `python -m experiments.run_benchmark --config ... --dataset ... --manifest ... --output-dir ... [--paper]`

- [x] **Step 1: Write failing tests for smoke and paper gating**

  Assert that a reviewed fixture produces one prediction per ID and that a
  pending-review dataset exits before provider execution in paper mode.

- [x] **Step 2: Run the focused tests and confirm the expected failures**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests/test_run_benchmark.py -q`

- [x] **Step 3: Implement the command and run manifest**

  Load and validate the corpus/dataset/config, execute IDs in stable order,
  write `predictions-input.jsonl`, call the existing scoring runner, and write
  a manifest containing source/config/dataset hashes, git revision, provider
  IDs, sample count, and run status.

- [x] **Step 4: Verify failure handling**

  Ensure provider exceptions produce an error manifest and non-zero exit status;
  they must not be converted into abstentions or successful empty answers.

### Task 4: Paper-ready report rendering

**Files:**
- Create: `experiments/report.py`
- Create: `experiments/tests/test_report.py`
- Create: `experiments/reports/README.md`

**Interfaces:**
- `render_comparison_report(run_dirs: Sequence[str | Path], output_dir: str | Path, *, baseline: str) -> dict`
- Outputs: `table-ii.csv`, `table-ii.tex`, `table-iii.csv`, `table-iii.tex`, `comparison.json`

- [x] **Step 1: Write failing report tests**

  Use two small run fixtures to assert stable variant order, selected metrics,
  formatted values, paired interval sidecars, and rejection of incomplete
  manifests.

- [x] **Step 2: Run the report tests and confirm failure**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests/test_report.py -q`

- [x] **Step 3: Implement report aggregation**

  Load only successful, paper-eligible runs, calculate single-system and paired
  bootstrap intervals from matching IDs, and render the requested Table II and
  Table III columns without hardcoded metric values.

- [x] **Step 4: Run the full experiment suite**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests -q`

### Task 5: Initial corpus artifacts and documentation

**Files:**
- Create: `experiments/corpus-sources.json`
- Create: `experiments/datasets/trustrag-project-draft.jsonl`
- Modify: `experiments/datasets/README.md`
- Modify: `experiments/README.md`

**Interfaces:**
- The source manifest lists only committed project documents.
- The draft JSONL is explicitly marked as pending review and cannot be used by
  paper mode.

- [x] **Step 1: Generate the corpus manifest and draft template**

  Include the approved project source paths and stable hashes; do not include
  document body text or credentials.

- [x] **Step 2: Validate the draft is intentionally not paper eligible**

  Run the dataset validator in smoke and paper modes and assert that smoke
  mode succeeds while paper mode rejects pending review status.

- [x] **Step 3: Document the human review gate and execution commands**

  Explain that the draft is a working artifact, not a result, and provide the
  exact command used after reviewers approve all records.

### Task 6: End-to-end smoke verification

**Files:**
- Modify: `experiments/tests/test_run_benchmark.py`
- Modify: `experiments/tests/test_report.py`

- [x] **Step 1: Run the smoke benchmark with a fake provider**

  Verify all five variant profiles produce valid prediction records and each
  run writes config, predictions, metrics, and manifest artifacts. Verify that
  the paper report renderer rejects those smoke manifests.

- [x] **Step 2: Run all research tests and static checks**

  Run: `ai-service/.venv/Scripts/python.exe -m pytest experiments/tests -q`

  Run: `git diff --check`

- [x] **Step 3: Confirm paper gating**

  Run the paper command against the pending draft and verify it exits without
  generating paper tables. Report this as the expected safety behavior.
