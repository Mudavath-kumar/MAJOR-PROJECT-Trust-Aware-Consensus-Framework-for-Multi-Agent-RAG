# TrustRAG Audit Remediation Plan

> **For agentic workers:** Execute task-by-task with test-first checkpoints. Preserve the existing dirty benchmark worktree.

**Goal:** Fix the verified RAG safety, upload/authentication, and research-measurement defects from the audit.

**Architecture:** Validate verifier evidence IDs at the AI boundary and again in consensus; produce the final TrustRAG answer only from verified claim text. Resolve chat scopes against ready, owned documents and clean partial vectors on ingestion failure. Instrument actual model-provider attempts around benchmark runs, include retrieval in latency, and calculate paired intervals by resampling paired records.

**Tech Stack:** Python 3 / pytest, TypeScript / Node test runner, existing FastAPI, Express, crypto, and research runner modules.

**Spec:** `docs/superpowers/specs/2026-10-06-audit-remediation.md`

## Global Constraints

- Preserve all existing uncommitted files and edits.
- Do not access or expose `.env` values or provider credentials.
- Keep provider fallback unchanged for application traffic; record attempts for evaluation.
- Never turn the draft dataset into paper results or mark review complete automatically.
- Run focused tests after each task and all relevant checks before reporting completion.

---

### Task 1: Evidence-grounded production consensus

**Files:**
- Modify: `ai-service/app/agents/schemas.py`
- Modify: `ai-service/app/agents/fact_checker.py`
- Modify: `ai-service/app/consensus/engine.py`
- Modify: `ai-service/app/api/rag.py`
- Test: `ai-service/tests/test_agent_schemas.py`
- Test: `ai-service/tests/test_consensus.py`

- [ ] Add tests proving unknown evidence IDs cannot verify claims, unsupported claims cannot appear in synthesis, an empty supported-claim set abstains, and alignment changes with disagreement rather than confidence magnitude.
- [ ] Run the focused AI tests and observe the expected failures.
- [ ] Validate verifier evidence IDs against retrieved chunk IDs; make consensus score only supported claims with in-scope evidence.
- [ ] Build the production synthesis from verified claim text and report deterministic synthesis metadata instead of exposing unverified reasoner text as the answer.
- [ ] Compute alignment from fact-checker/critic decisions for the same claim IDs.
- [ ] Rerun `ai-service/.venv/Scripts/python.exe -m pytest ai-service/tests -q` from the repository root.

### Task 2: Auth, upload rollback, and ready-document scope

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/controllers/document.controller.ts`
- Modify: `backend/src/controllers/chat.controller.ts`
- Modify: `backend/src/routes/document.routes.ts`
- Modify: `ai-service/app/rag/vectorstore.py`
- Test: `backend/test/service-auth.test.ts`
- Test: `backend/test/security-scope.test.ts`
- Test: `ai-service/tests/test_vectorstore_scope.py`

- [ ] Add a real-keypair JWT signature regression for ES256 and preserve the RS256 verification path.
- [ ] Add scope tests showing empty document IDs match no vectors and chat scopes contain only ready, owned documents.
- [ ] Add upload failure coverage for best-effort AI vector cleanup and align extension/MIME allowlists with supported extractors.
- [ ] Run the focused tests and observe the expected failures.
- [ ] Implement the smallest changes that satisfy those contracts.
- [ ] Run backend tests/build and AI vector-scope tests.

### Task 3: Faithful benchmark telemetry and intervals

**Files:**
- Create: `ai-service/app/core/llm_telemetry.py`
- Modify: `ai-service/app/core/llm_router.py`
- Modify: `experiments/run_benchmark.py`
- Modify: `experiments/variant_runner.py`
- Modify: `experiments/bootstrap.py`
- Modify: `experiments/report.py`
- Test: `ai-service/tests/test_llm_telemetry.py`
- Test: `experiments/tests/test_bootstrap.py`
- Test: `experiments/tests/test_run_benchmark.py`

- [ ] Add tests that paired intervals recompute the metric over matched record resamples and that benchmark latency includes context retrieval.
- [ ] Add tests that provider/model attempt telemetry records fallback attempts without recording credentials.
- [ ] Run focused tests and observe the expected failures.
- [ ] Instrument provider attempts using async-context-local telemetry; write provider/model identifiers into run artifacts and count actual attempts.
- [ ] Time retrieval plus variant execution in the benchmark adapter.
- [ ] Replace per-record paired deltas with paired record-resampling and recompute metrics for each sampled pair.
- [ ] Run focused benchmark tests and the full experiment suite; document any environment-only event-loop limitation.

### Task 4: Final repository checks and limitations

- [ ] Run AI, backend, frontend contract, type-check, build, lint, and experiment checks that the environment permits.
- [ ] Confirm `git diff --check` and review the final diff, preserving unrelated benchmark work.
- [ ] Report unresolved live-browser authentication and human dataset-review requirements separately from code fixes.
