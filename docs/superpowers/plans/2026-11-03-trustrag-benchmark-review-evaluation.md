# TrustRAG Benchmark Review and Evaluation Plan

> **For agentic workers:** Execute this plan in the current session and track each verified step.

**Goal:** Produce a transparent per-record v4 evidence audit, run the six benchmark variants on eligible records, and update the open paper only with traceable measurements.

**Architecture:** Preserve the candidate and corpus snapshots. Store automated review outcomes separately with record-level notes and reviewer type. Use the existing matrix runner and metric/report pipeline; keep runs exploratory when the required human-review gate is unmet.

**Tech Stack:** Python benchmark tooling, JSON/JSONL dataset snapshots, configured AI service providers, IEEE LaTeX source.

**Spec:** User request; `experiments/README.md`; `experiments/datasets/trustrag-public-candidate-v4/REVIEW-GUIDE.md`.

## Global Constraints

- Do not alter the original candidate or source corpus.
- Do not claim automated review is human approval.
- Do not fabricate labels, results, telemetry, or costs.
- Do not include unsupported metrics or paper claims.
- Keep existing user changes intact.

---

### Task 1: Verify candidate and evidence snapshots

- [x] Check schema, unique IDs, category counts, source linkage, evidence scope, and snapshot hashes.
- [x] Audit all candidate records against their cited source evidence; save automated decisions with explicit provenance and per-record reasons. Human semantic review remains pending where flagged.
- [x] Save separate automated-review artifacts and a machine-readable audit summary; do not represent them as human-approved or frozen.

### Task 2: Verify and execute six variants

- [x] Confirm shared dataset/configuration and actual implementation of all six profiles.
- [x] Check review-policy gates and configured provider readiness without disclosing secrets.
- [x] Attempt the exploratory matrix; all attempts stopped at corpus embedding preflight, before any query execution. Error manifests are retained.
- [ ] Generate empirical overall/category tables and uncertainty summaries after successful query predictions; currently all values remain NM.

### Task 3: Update and validate paper

- [x] Update the existing IEEE source using the actual audit and failed-run artifacts, keeping performance outcomes NM.
- [x] Compile the open source file in the connected document editor.
- [x] Run relevant benchmark tests/builds and record the remaining external quota and human-review blockers.
