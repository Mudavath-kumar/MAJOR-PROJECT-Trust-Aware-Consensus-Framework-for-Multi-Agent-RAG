# Public RAG Benchmark Dataset Implementation Plan

> **For agentic workers:** Execute inline with the plan-and-test workflow; preserve all pre-existing worktree changes.

**Goal:** Replace the empty TrustRAG draft with a reproducible, attributed, review-gated candidate benchmark derived from public HotpotQA validation examples and clearly marked controlled challenge cases.

**Architecture:** A deterministic converter consumes ten frozen 20-row HotpotQA validation API responses at recorded dispersed indexes, writes a compact corpus snapshot and the 200-record JSONL candidate, and hashes every corpus source. Answerable and prompt-injection cases retain gold answers and supporting evidence; supporting-fact-removed and controlled-conflict cases remain abstention targets. Review fields remain pending until two humans independently check them.

**Tech Stack:** Python 3 standard library, existing `experiments.corpus` chunk/hash functions, pytest, JSON/JSONL, Markdown corpus files.

**Spec:** `docs/superpowers/specs/2026-10-06-research-benchmark-design.md`, updated to incorporate the public-data source and answerable prompt-injection protocol.

## Global Constraints

- Attribute HotpotQA and its CC BY-SA 4.0 license in the dataset documentation.
- Freeze the downloaded source rows and record their SHA-256 hashes; do not depend on a live API during benchmark runs.
- Keep all reviewer fields `pending`; never approve labels on a reviewer’s behalf.
- Prompt-injection cases remain answerable from trusted evidence and are not counted as expected abstentions.
- Unanswerable cases are defined relative to the documents scoped to that query.
- Synthetic conflict and injection additions must be explicit in record provenance and reported as controlled challenge cases.
- Run only local tests; do not run the six-variant provider matrix or incur model charges.

---

### Task 1: Correct metric semantics for prompt injection

**Files:** `experiments/metrics.py`, `experiments/runner.py`, `experiments/report.py`, `experiments/tests/test_metrics.py`, `experiments/tests/test_dataset.py`, `experiments/tests/test_run_matrix.py`

- [x] Add a failing test requiring injected-context cases to count as answerable task-preservation examples.
- [x] Confirm the test fails because the current scorer counts them as unsafe.
- [x] Implement injection answerability and a separate task-success metric; require a gold answer and evidence for injection records.
- [x] Run metrics, dataset, matrix, and report tests.

### Task 2: Freeze and attribute public source rows

**Files:** `experiments/datasets/hotpot-validation-sampled-200.source.json`, `experiments/tests/test_public_dataset_builder.py`

- [x] Freeze ten dispersed 20-row official validation API responses as one source snapshot.
- [x] Record source URL, dataset split, retrieval date, CC BY-SA 4.0 attribution, source-row count, response SHA-256 hashes, and row indexes.
- [x] Test overlapping row indexes, malformed support-fact indexes, and source-response provenance.

### Task 3: Build corpus-scoped candidate records

**Files:** `experiments/build_public_dataset.py`, `experiments/datasets/trustrag-public-candidate-sampled-v2/`, `experiments/datasets/README.md`

- [x] Convert 100 validation examples into answerable candidates using the source's annotated supporting facts.
- [x] Convert 50 distinct examples into scoped cases with annotated supporting facts removed.
- [x] Convert 25 distinct examples into controlled synthetic contradictions and 25 into answerable injected-context resilience cases.
- [x] Record per-record source IDs and synthetic challenge provenance; set all review states pending.
- [x] Validate exact 100/50/25/25 composition, evidence-to-document ownership, and review-pending state.

### Task 4: Enforce per-record retrieval scope

**Files:** `experiments/run_benchmark.py`, `experiments/tests/test_run_benchmark.py`

- [x] Add a test proving unrelated corpus documents cannot enter a query's retrieval context.
- [x] Filter retrieval by each record's declared document IDs before ranking.
- [x] Verify candidate query retrieval is scoped to declared document IDs.

### Task 5: Documentation and verification

**Files:** `experiments/README.md`, `docs/research-scope.md`, `experiments/datasets/README.md`

- [x] Document source attribution, synthetic-case limits, reviewer process, and the fact that candidate data is not paper-eligible.
- [ ] Run all `experiments/tests` and `git diff --check`.
- [x] Confirm the matrix still refuses the pending candidate before any provider call.

**Verification note:** 44 non-async experiment tests pass and `git diff
--check` passes. The remaining 10 tests in `test_run_benchmark.py` and
`test_variant_runner.py` could not be completed in this Windows sandbox because
Python asyncio event-loop initialization blocks in its restricted socket-pair
fallback (`socket.accept`); this is an environment limitation, not a passing
test result. Re-run those two files in a normal Windows or Linux development
environment before paper execution.

