# TrustRAG Live Deployment Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the committed TrustRAG source with the production architecture, prevent silent misconfiguration, and verify the frontend, backend, AI service, storage, and authentication boundaries before deployment.

**Architecture:** Vercel serves the frontend and calls one Express API gateway. Render runs the Express gateway and a separately authenticated FastAPI RAG service. MongoDB Atlas stores metadata and tenant-scoped vectors; Backblaze B2 stores original files; Gemini/OpenRouter/Tavily remain server-side only.

**Tech Stack:** React/TypeScript, Vite/TanStack Router, Express/TypeScript, FastAPI/Python, MongoDB Atlas, Backblaze B2, Clerk/JWT, Render, and Vercel.

**Spec:** `PRD.txt` and `docs/superpowers/plans/2026-09-30-production-hardening.md`

## Global Constraints

- No demo users, fake evidence, optimistic scores, local storage fallback, or embedded backend AI.
- Every protected route requires a verified bearer token and every document/vector operation is tenant-scoped.
- API keys remain in Render/Vercel secret managers and are never pasted into chat or shipped to the browser.
- A document is ready only after storage, extraction, chunking, embedding, and vector persistence succeed.
- Completion claims require fresh tests/build output and live endpoint evidence.

### Task 1: Add deployment configuration guardrails

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `test/frontend-no-demo.test.mjs`
- Test: `test/frontend-no-demo.test.mjs`

**Interfaces:**
- Production builds fail clearly when `VITE_API_URL` is missing or points at localhost.
- Development keeps the explicit local default so local preview remains usable.

- [ ] Write a failing test that rejects a production frontend configuration which silently defaults to localhost.
- [ ] Run the focused test and confirm the expected failure.
- [ ] Implement the smallest build-time/runtime guard with a safe development-only default.
- [ ] Run the focused test and the frontend typecheck/build.

### Task 2: Verify security and service-boundary contracts

**Files:**
- Modify: `backend/test/fail-closed-boundary.test.ts`
- Modify: `backend/src/config/environment.ts` only if a failing contract requires it.
- Modify: `ai-service/tests/test_vectorstore_scope.py` only if a failing contract requires it.

**Interfaces:**
- Missing/invalid internal AI tokens return 401.
- Missing/invalid user authentication returns 401.
- Vector queries require a user scope and never use an unscoped fallback.

- [ ] Add a failing regression assertion for the live issue's source-level contract: no demo authentication or unscoped endpoint behavior.
- [ ] Run the focused test and confirm it fails for the expected reason.
- [ ] Implement only the missing guard.
- [ ] Run backend and Python focused tests.

### Task 3: Make deployment metadata point to the intended services

**Files:**
- Modify: `render.yaml`
- Modify: `vercel.json`
- Modify: `README.md`
- Modify: `BACKEND_AI_GUIDE.md`
- Modify: `backend/.env.example`
- Modify: `ai-service/.env.example`

**Interfaces:**
- Render starts the Express gateway from `backend/` and FastAPI from `Dockerfile.ai-service`.
- The two Render services share the exact `AI_SERVICE_TOKEN`.
- Vercel receives `VITE_API_URL` from its project environment rather than a stale hardcoded bundle.
- Required secret names are documented without secret values.

- [ ] Compare all service paths and variable names against the actual startup commands.
- [ ] Patch only stale or ambiguous deployment documentation/configuration.
- [ ] Run YAML/configuration checks and search for old service URLs, demo endpoints, and Ollama fallbacks.

### Task 4: Full local verification and deployment handoff

**Files:**
- Modify: `backend/scripts/e2e-smoke.mjs` if its checks do not match the current contracts.
- Create: `docs/production-readiness.md`

- [ ] Run backend tests and TypeScript compilation.
- [ ] Run frontend tests, TypeScript compilation, lint, and production build.
- [ ] Run Python tests/compile checks.
- [ ] Start services only when dependencies are available, then run the smoke checks.
- [ ] Record what is verified locally, what needs the user's Render/Vercel deployment action, and the exact secret variable names required.

## Completion Criteria

- The source branch contains the fix and a regression test for every changed behavior.
- Local verification has fresh exit-code evidence.
- The handoff states plainly whether live deployment is updated; no live success is claimed until the current Vercel bundle and Render endpoints report the new architecture and protected routes return 401 without a token.
