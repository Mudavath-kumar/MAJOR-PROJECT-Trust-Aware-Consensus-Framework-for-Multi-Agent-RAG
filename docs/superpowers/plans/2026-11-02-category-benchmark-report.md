# Category-Wise Benchmark Reporting Plan

> **For agentic workers:** Execute inline using the repository's test-driven workflow.

**Goal:** Add reproducible per-category comparison output for the six configured systems and describe the pending status honestly in the IEEE paper.

**Architecture:** Keep metric definitions in `experiments/metrics.py` and make report generation stratify the already validated prediction records by answer type. Emit category results alongside current overall CSV/JSON/LaTeX artifacts; update the paper with an NM-only category table while the reviewed dataset gate remains closed.

**Tech Stack:** Python, pytest, Node/TypeScript dataset audit, LaTeX/TikZ.

**Constraints:** Do not change or approve candidate records; do not freeze a reviewed snapshot; do not call paid providers or production APIs; do not create numeric performance results without eligible runs.

---

### Task 1: Re-audit the candidate and review gate

- [x] Validate record count, unique IDs, required fields, categories, and review state from the v4 JSONL.
- [x] Confirm no reviewed export or eligible run artifacts are in the checkout.
- [x] Run the authoritative backend corpus/source integrity audit and record test output.

### Task 2: Add category-wise result artifacts

- [x] Add a failing report test with mixed answer types and class-specific denominator assertions.
- [x] Implement category metric aggregation and per-category CSV, JSON, and TeX output.
- [x] Verify `N/A` is used only for inapplicable metrics; actual unmeasured paper results remain `NM`.
- [x] Preserve paper-mode retrieved passages, stage outputs, and raw model outputs; omit passage/raw text from smoke artifacts.
- [x] Preserve completed predictions and failed-query telemetry in partial error runs.
- [x] Make zero-coverage selective risk unavailable instead of reporting a false zero.

### Task 3: Update paper and verify

- [x] Add the category-wise six-variant NM table and define each outcome and denominator.
- [x] Run AI-service, experiment, backend, and frontend tests/builds.
- [x] Compile the open LaTeX source and report the lack of approved data/run outputs as the blocker.
