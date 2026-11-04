# TrustRAG End-to-End Chat Reliability Plan

> **For agentic workers:** Use this plan in the current session; preserve all pre-existing worktree changes and stage only files changed for this task.

**Goal:** Audit and repair the real document-grounded chat path across frontend, backend, AI service, and every invoked verification component.

**Architecture:** The browser authenticates with Clerk and calls the Express API. The backend scopes documents and conversations to the authenticated user and forwards queries to FastAPI. FastAPI retrieves that user's indexed chunks, calls the configured agents, computes evidence-based consensus, and returns cited answers or an explicit abstention.

**Tech Stack:** TanStack Start/React, Express/Mongoose, FastAPI/Pydantic, Gemini, OpenRouter, MongoDB Atlas Vector Search.

**Spec:** `PRD.txt` sections 1, 4, 7, and 8.

## Global Constraints

- Preserve existing uncommitted user work; do not use `git add .` or reset files.
- Never bypass Clerk authentication or tenant scoping to make a query appear successful.
- Never fabricate evidence, citations, agent outputs, or test results.
- Use TDD for code changes and keep provider errors actionable without logging credentials.
- Report separate results for source tests, local health, actual retrieval, actual generation, and deployed health.

---

### Task 1: Inventory and trace the production chat path

**Files:** `PRD.txt`, `src/routes/app.chat.tsx`, `src/lib/api-client.ts`, `backend/src`, `ai-service/app`.

- [ ] Read repo instructions, PRD, and current `git status`; preserve all existing modified and untracked files.
- [ ] Trace chat submission from the browser API call through auth, backend ownership checks, service-token forwarding, retrieval, agent execution, consensus, and response rendering.
- [ ] Map each agent to its implementation function and prove whether the live route calls it.
- [ ] Record reproducible failures and distinguish provider outages, missing indexed chunks, Clerk load failures, and code defects.

### Task 2: Audit independent frontend and backend boundaries

**Files:** `src/routes/app.chat.tsx`, `src/lib/api-client.ts`, `src/lib/doc-store.ts`, `backend/src/routes`, `backend/src/controllers`, `backend/src/middleware`, `backend/src/services`.

- [ ] Check Clerk readiness, request timeouts/retries, error mapping, response parsing, upload state, tenant authorization, and AI-service forwarding.
- [ ] Make no changes until a failure is tied to a source path and function.

### Task 3: Audit AI retrieval, five agents, and consensus

**Files:** `ai-service/app/api/rag.py`, `ai-service/app/agents`, `ai-service/app/consensus`, `ai-service/app/core`, `ai-service/app/rag`.

- [ ] Trace researcher, fact checker, trust assessor, critic, reasoner, optional external verification, and consensus calls from the HTTP route.
- [ ] Verify model routing, retries, agent output validation, citations, user/document filters, abstention thresholds, and telemetry.
- [ ] Add a failing regression test for each confirmed defect, then implement the smallest fix and verify the test passes.

### Task 4: Validate and run the full local stack

**Files:** Existing service-specific tests and build scripts only.

- [ ] Run AI-service tests, backend build/tests, frontend checks/build, and `git diff --check`.
- [ ] Start frontend, backend, and AI service; verify health, authenticated API behavior, document retrieval, and one grounded chat query only when an existing eligible indexed document is available.
- [ ] Do not mutate production data or upload documents without explicit approval.
- [ ] Report exact passes, failures, and external blockers; do not claim full end-to-end success if Clerk, evidence, or provider access prevents it.
