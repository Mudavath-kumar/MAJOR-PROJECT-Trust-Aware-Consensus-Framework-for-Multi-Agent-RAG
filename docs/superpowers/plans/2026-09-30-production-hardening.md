# TrustRAG Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and superpowers:verification-before-completion while executing each task.

**Goal:** Make the canonical `trustarc-core` project fail closed, preserve user isolation, and provide one truthful frontend → backend → storage → AI → retrieval → consensus flow that can be verified locally and deployed consistently.

**Architecture:** The Express backend remains the authenticated API gateway and document metadata owner. The FastAPI service becomes the only AI/RAG execution layer; the backend will not synthesize answers or silently create local indexes when that service is unavailable. The frontend will render only server-backed state, while Backblaze stores original files and the configured vector store stores user-scoped chunks.

**Tech Stack:** TanStack Start/React/TypeScript, Express/TypeScript/Mongoose, FastAPI/Python, MongoDB, Backblaze B2, configured Gemini/OpenRouter/Tavily providers, Node built-in test runner through the existing backend `tsx` dependency.

**Spec:** `PRD.txt`, especially sections 9–16, 18–31, 41–57, 66–75.

## Global Constraints

- The frontend must not perform core AI reasoning or answer synthesis.
- Every retrieval, chunk inspection, delete, and upload operation must be scoped to the authenticated user.
- No answer, score, evidence, status, or analytics value may be fabricated when the backend or AI service is unavailable.
- The AI service must fail closed when no real embedding or LLM provider is available.
- API keys must never be returned to the browser or stored in plaintext user settings for production.
- The canonical source tree is `trustarc-core`; generated folders and parent-level legacy files are outside the application source and must not be used as runtime sources.
- Each implementation slice must have a failing test before its production code change and a fresh verification command afterward.

---

### Task 1: Establish regression-test harness and tenant-scope primitives

**Files:**
- Create: `backend/test/security-scope.test.ts`
- Create: `backend/src/utils/security-scope.ts`
- Modify: `backend/package.json`

**Interfaces:**
- `assertRequestedDocumentIdsAreOwned(requestedIds: string[] | undefined, ownedIds: string[]): string[]` returns a normalized requested scope or throws a 403-compatible error.
- `withUserScope<T extends Record<string, unknown>>(filter: T, userId: string): T & { user_id: string }` always adds the authenticated user scope.

- [ ] **Step 1: Write failing tests** for an unowned requested document, duplicate IDs, empty scope, and mandatory user scope.
- [ ] **Step 2: Run `npm test -- --test-name-pattern=security-scope` from `backend` and confirm the tests fail because the utility does not exist.
- [ ] **Step 3: Implement the smallest pure utilities and add a `test` script using `tsx --test`.
- [ ] **Step 4: Run the focused test and confirm it passes.
- [ ] **Step 5: Commit only this slice if committing is requested; otherwise continue with the dirty worktree preserved.

### Task 2: Enforce tenant isolation and authenticated service boundaries

**Files:**
- Modify: `backend/src/controllers/chat.controller.ts`
- Modify: `ai-service/app/rag/vectorstore.py`
- Modify: `ai-service/app/api/rag.py`
- Modify: `ai-service/app/main.py`
- Modify: `backend/src/services/ai.service.ts`
- Modify: `backend/src/config/environment.ts`
- Modify: `ai-service/app/core/config.py`
- Test: `backend/test/security-scope.test.ts`

**Interfaces:**
- Chat validates every requested document ID against `DocumentModel.find({ user_id, _id: { $in } })` before calling AI.
- Backend-to-AI requests send `X-TrustRAG-Service-Token`; FastAPI rejects missing or invalid tokens with 401.
- Vector queries always include both `user_id` and optional `document_id` filters, including fallback queries.

- [ ] **Step 1: Add failing assertions that an unowned scope is rejected and that a missing internal token is rejected at the service boundary.
- [ ] **Step 2: Run the focused test and capture the expected failure.
- [ ] **Step 3: Implement ownership validation, shared-token configuration, and unconditional user filters.
- [ ] **Step 4: Run the focused test plus a static search proving no document-scoped branch omits `user_id`.
- [ ] **Step 5: Verify error responses do not disclose another user’s document existence.

### Task 3: Remove backend AI fallbacks and make storage/indexing fail closed

**Files:**
- Modify: `backend/src/services/ai.service.ts`
- Modify: `backend/src/services/storage.service.ts`
- Modify: `backend/src/controllers/document.controller.ts`
- Modify: `backend/src/controllers/chat.controller.ts`
- Modify: `backend/src/models/Document.ts`
- Modify: `backend/src/controllers/settings.controller.ts`
- Modify: `backend/src/models/Settings.ts`
- Test: `backend/test/storage-and-ai-boundary.test.ts`

**Interfaces:**
- Upload returns an error if Backblaze is not configured or upload fails; it never writes `local-only` metadata.
- PDF/DOCX indexing fails with an explicit processing error if AI extraction is unavailable; it never indexes placeholder text.
- AI query failure returns a controlled 502/503; it never produces heuristic text or default high scores.
- User API credentials are accepted only as write-only secrets and are never returned or persisted unencrypted in production.

- [ ] **Step 1: Add failing tests for missing B2 configuration, AI timeout, and placeholder-answer prevention.
- [ ] **Step 2: Run the focused tests and confirm they fail against current soft fallback behavior.
- [ ] **Step 3: Replace soft upload/delete and embedded AI paths with fail-closed behavior, cleanup orphaned B2 objects on indexing failure, and validate settings payloads.
- [ ] **Step 4: Run focused tests and inspect HTTP error shapes.
- [ ] **Step 5: Verify all default scores in persistence are zero/unknown rather than optimistic values.

### Task 4: Make the FastAPI RAG pipeline truthful and configurable

**Files:**
- Modify: `ai-service/app/rag/embeddings.py`
- Modify: `ai-service/app/rag/vectorstore.py`
- Modify: `ai-service/app/api/rag.py`
- Modify: `ai-service/app/consensus/engine.py`
- Modify: `ai-service/app/agents/researcher.py`
- Modify: `ai-service/app/agents/fact_checker.py`
- Modify: `ai-service/app/agents/critic.py`
- Modify: `ai-service/app/agents/reasoner.py`
- Create or modify: `ai-service/tests/test_rag_contract.py`

**Interfaces:**
- Embedding failure raises a service error in production; sparse hashing is available only in explicitly local development mode.
- Retrieval returns only scored matches above the configured threshold and never assigns a constant similarity score.
- `chunk_size`, `chunk_overlap`, `top_k`, and `similarity_threshold` come from validated settings.
- External verification stores source metadata and triggers exactly one bounded re-consensus pass.
- Consensus scores are computed from actual agent outputs and evidence; no default high-confidence claims are emitted.

- [ ] **Step 1: Add failing Python tests for empty/failed embeddings, irrelevant fallback rows, threshold abstention, and bounded external verification.
- [ ] **Step 2: Run them with `python -m unittest` or `pytest` and confirm the expected failures; if Python is unavailable, record that as an environment blocker instead of claiming a pass.
- [ ] **Step 3: Implement minimal truthful retrieval, settings propagation, and bounded verification behavior.
- [ ] **Step 4: Run the Python tests and inspect structured query responses.
- [ ] **Step 5: Verify the health endpoint reports provider readiness based on an actual configured provider, not merely a nonempty key.

### Task 5: Remove frontend demo state and align UI with server truth

**Files:**
- Modify: `src/lib/doc-store.ts`
- Modify: `src/lib/trustrag-data.ts`
- Modify: `src/routes/app.chat.tsx`
- Modify: `src/routes/app.index.tsx`
- Modify: `src/routes/app.analytics.tsx`
- Modify: `src/routes/app.knowledge.tsx`
- Modify: `src/routes/app.upload.tsx`
- Modify: `src/routes/app.settings.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/app.tsx`
- Test: `src/lib/*.test.ts` or the nearest available frontend test harness

**Interfaces:**
- Failed API calls render explicit unavailable/error states and do not seed documents, chunks, answers, scores, or notifications.
- Upload progress represents actual request/indexing state; it does not use random timers.
- Chat displays returned agent executions and scores only; in-flight UI remains neutral until the server response arrives.
- Clerk configuration is required; no hardcoded publishable key is shipped.

- [ ] **Step 1: Add failing tests for empty backend state, no local answer synthesis, and required auth configuration.
- [ ] **Step 2: Run focused frontend tests and capture the failure.
- [ ] **Step 3: Delete static seed/demo paths and map empty/error/loading states to real API responses.
- [ ] **Step 4: Run TypeScript and frontend tests.
- [ ] **Step 5: Manually verify upload, knowledge base, chat, analytics, and settings do not show fake values when APIs are offline.

### Task 6: Repair environment, deployment, and dependency reproducibility

**Files:**
- Modify: `render.yaml`
- Modify: `vercel.json`
- Modify: `README.md`
- Modify: `BACKEND_AI_GUIDE.md`
- Modify: `APPROACHES.md`
- Modify: `backend/.env.example`
- Modify: `ai-service/.env.example`
- Modify: `package.json`
- Remove only if verified unused: `pnpm-lock.yaml` or `bun.lock`

**Interfaces:**
- One package manager and one lockfile are authoritative.
- Render paths resolve from the actual Git repository root.
- Required production variables include MongoDB, B2 endpoint/credentials/bucket, AI service URL/token, Clerk issuer/JWKS or supported auth configuration, CORS origins, and provider keys.
- Documentation describes the implemented vector store, embeddings, routes, ports, and startup commands.

- [ ] **Step 1: Add a configuration validation test that reports missing required names without printing secret values.
- [ ] **Step 2: Run it against the example files and confirm current deployment configuration fails.
- [ ] **Step 3: Normalize the package manager, Render paths, environment names, and service startup commands.
- [ ] **Step 4: Run clean install, frontend typecheck/lint/build, backend typecheck/test, and Python compile/tests.
- [ ] **Step 5: Start all three services and run the authenticated E2E smoke test.

### Task 7: Production verification and handoff

**Files:**
- Modify: `backend/scripts/e2e-smoke.mjs`
- Create: `docs/production-readiness.md`

- [ ] **Step 1: Extend E2E coverage for upload persistence, document ownership, delete cleanup, no-evidence abstention, and AI-service-down failure behavior.
- [ ] **Step 2: Run the E2E test against clean local services and verify test-user cleanup.
- [ ] **Step 3: Run security searches for secrets, demo data, fabricated scores, and unauthenticated internal endpoints.
- [ ] **Step 4: Record exact commands, results, known external prerequisites, and remaining risks in the readiness document.
- [ ] **Step 5: Report only claims supported by fresh command output.

## Spec Coverage Review

- PRD architecture and separation: Tasks 2–5.
- Authentication, authorization, and isolation: Tasks 1–3.
- Upload, extraction, chunking, embedding, retrieval, reranking, and answer generation: Tasks 3–4.
- Agents, consensus, confidence, abstention, and external verification: Task 4.
- Frontend evidence, analytics, settings, loading, and error states: Task 5.
- Security, configuration, deployment, observability, and testing: Tasks 2, 6, and 7.
- Research evaluation and calibration remain outside production repair scope and must be explicitly documented as not yet implemented if absent.

