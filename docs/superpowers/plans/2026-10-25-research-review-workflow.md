# Research Benchmark Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, persistent one-human-plus-automated review workflow for the corrected 200-record v4 research candidate, and allow only a complete verified export into paper evaluation.

**Architecture:** The Express API reads a fixed dataset and corpus from repository-relative paths, runs integrity checks before exposing it, and stores per-user decisions in a Mongo model. A distinct authenticated TanStack route reviews records through the existing `ApiClient`; export creates a new JSONL response only after all 200 decisions and integrity checks pass. The Python paper runner accepts the explicit one-human protocol only with valid review metadata while preserving its existing two-human protocol.

**Tech Stack:** TypeScript, Express, Mongoose, Clerk bearer authentication, React, TanStack Router, Vite, Python, pytest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-24-research-review-workflow-design.md`

## Global Constraints

- Keep the production chat audit at `/app/evaluations` unchanged.
- Scope serving and export to `trustrag-public-candidate-v4`; never accept a client filesystem path or reviewer identity.
- Persist reviews by authenticated user, dataset version, and record ID; never expose another user's notes.
- Human approval is explicit; automated checks cannot approve records or claim semantic correctness.
- Correction decisions require a note; only `approved` and `needs_correction` are valid decisions.
- Export only a fresh, fully approved 200-record copy with truthful `one-human-plus-automated` protocol metadata.
- Preserve existing two-human paper datasets and do not make external model/provider calls during review.
- Preserve all unrelated pre-existing worktree modifications; stage or modify only files required by this feature.

---

### Task 1: Backend fixed-dataset integrity reader

**Files:**
- Create: `backend/src/services/research-benchmark.ts`
- Create: `backend/test/research-benchmark.test.ts`
- Read: `experiments/datasets/trustrag-public-candidate-v4/trustrag-project-draft.jsonl`
- Read: `experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json`
- Read: `experiments/datasets/hotpot-validation-sampled-200.source.json`

**Interfaces:**
- `loadResearchBenchmark()` returns the immutable dataset version, candidate rows, original source rows, corpus manifest, audit result, and SHA-256 provenance metadata.
- `getResearchBenchmarkRecord(recordId)` returns one allowlisted row with trusted and synthetic scoped document text or throws a typed not-found/integrity error.
- `auditResearchBenchmark()` checks 200-row composition, unique IDs, source linkage/license, manifest document hashes/evidence IDs, scoped corpus paths and hashes, supporting-fact presence/absence, and synthetic conflict/injection labels.

- [ ] Write tests for valid corpus audit, unknown IDs, tampered corpus hash, composition mismatch, path escape, and facts absent/present by category.
- [ ] Run `node --import tsx --test backend/test/research-benchmark.test.ts` and confirm the missing service/tests fail for the expected reasons.
- [ ] Implement fixed-path loading, path containment, source/document mapping, support fact checks, and audit hashes without network calls.
- [ ] Re-run the focused test and require a passing audit over the checked-in v4 candidate, including no synthetic conflict gold evidence IDs.

### Task 2: Per-user review persistence and authenticated API

**Files:**
- Create: `backend/src/models/ResearchBenchmarkReview.ts`
- Create: `backend/src/controllers/research-benchmark.controller.ts`
- Create: `backend/src/routes/research-benchmark.routes.ts`
- Modify: `backend/src/server.ts`
- Create: `backend/test/research-benchmark-api.test.ts`

**Interfaces:**
- `GET /api/v1/research/benchmark` returns audit/progress and filtered, paginated list rows with only the current user's decisions.
- `GET /api/v1/research/benchmark/:recordId` returns source/corpus details and this user's review.
- `PUT /api/v1/research/benchmark/:recordId/review` accepts `{decision, notes, expectedUpdatedAt}`; user ID is always `req.user._id`.
- `GET /api/v1/research/benchmark/export` returns a JSONL attachment only when all 200 records are approved by the current user and the fixed-candidate audit passes.

- [ ] Write tests for unauthenticated requests, user isolation, invalid decision, missing correction note, note length, stale timestamp, DB unavailable, unknown ID, incomplete export gate, and complete export provenance.
- [ ] Run focused API tests and observe expected failures before implementing handlers.
- [ ] Add a compound unique index on `(user_id, dataset_version, record_id)`, timestamps, bounded notes, expected timestamp conflict protection, and fail-closed DB checks.
- [ ] Mount authenticated routes at the documented API prefix and confirm the response has no path traversal or cross-user note leakage.
- [ ] Run backend typecheck and focused tests.

### Task 3: Python paper-runner review protocol adapter

**Files:**
- Modify: `experiments/runner.py`
- Modify: `experiments/run_matrix.py`
- Create: `experiments/tests/test_review_protocol.py`
- Read: `experiments/report.py`

**Interfaces:**
- Dataset validation continues to accept existing rows with `reviewer_a=approved`, `reviewer_b=approved`, and `resolution=resolved`.
- A reviewed export is accepted only when every row declares `review_protocol=one-human-plus-automated`, `human_reviewer_count=1`, `human_review_status=approved`, the same v4 dataset version, and a matching review audit hash/version manifest.
- Run manifests and rendered report metadata record the actual review protocol without labeling the human as two reviewers.

- [ ] Add tests that reject pending/incomplete/invalid protocol metadata before provider calls and accept a valid one-human export while preserving two-human behavior.
- [ ] Run the new tests red, then implement validation and manifest/report protocol recording.
- [ ] Run focused pytest suite and all existing runner/matrix tests.

### Task 4: Frontend API methods, route, and navigation

**Files:**
- Modify: `src/lib/api-client.ts`
- Modify: `src/routes/app.tsx`
- Create: `src/routes/app.research-review.tsx`
- Update generated: `src/routeTree.gen.ts` through the repository router generation/build command
- Create: `src/lib/research-review.test.ts` only if the existing frontend test runner supports it without new dependencies; otherwise verify the typed client and built route directly.

**Interfaces:**
- Typed `ApiClient` methods expose list, record, review save, and blob export endpoints.
- Route `/app/research-review` uses the existing authenticated shell, dark theme, primitives, and API client.
- Review list supports category/status filters, question/ID search, paging and previous/next selection; detail shows original source answer/facts, trusted evidence documents, and clearly marked synthetic challenge content.
- Save controls validate notes and decisions, handle stale-write errors, confirm changing prior decisions, and show loading/error/success states.
- Export explains the remaining gate and downloads JSONL only after API approval.

- [ ] Add client types/methods and route navigation; use the real authenticated backend session.
- [ ] Implement responsive list/detail UI with accessible labels and honest automated-audit limitations.
- [ ] Run router generation, frontend typecheck/lint, and production build.

### Task 5: Deployment data preflight, docs, and integrated verification

**Files:**
- Modify: `backend/package.json` only if a targeted test script is appropriate.
- Modify: `render.yaml` only if the existing build/runtime configuration excludes required `experiments/` files.
- Modify: `docs/research-scope.md`
- Create: `experiments/datasets/trustrag-public-candidate-v4/README.md`

- [ ] Confirm the backend deployment package retains repository-level v4 data; research routes fail with a clear 503 if data are missing, leaving unrelated backend features available.
- [ ] Document that automated checks are consistency checks, semantic review is human, and paper results are unavailable until 200 records are approved and evaluated.
- [ ] Run all relevant backend tests/build, frontend lint/build, and benchmark pytest suites; report any environment-blocked tests explicitly.
- [ ] Start backend and frontend preview when local environment permits; verify route loads, API auth gating, record detail, save, and export gate. Do not claim logged-in save/export without a working authenticated Mongo connection.
- [ ] Review the final diff and ensure unrelated dirty files remain untouched.
