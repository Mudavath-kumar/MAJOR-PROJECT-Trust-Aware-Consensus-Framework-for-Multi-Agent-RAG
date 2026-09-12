# TrustRAG PRD Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the TrustRAG frontend, Express backend, and FastAPI RAG service into one production-shaped system that satisfies the PRD without fabricated data.

**Architecture:** MongoDB is the system of record for users, documents, conversations, messages, settings, and audit records. The Express API owns authentication, authorization, file storage, and persistence. FastAPI owns extraction, chunking, embeddings, retrieval, reranking, multi-agent verification, consensus, abstention, and optional external verification. The frontend consumes the API and never invents evidence.

**Tech Stack:** React/TanStack Start, TypeScript, Express, Mongoose, JWT, FastAPI, Pydantic, ChromaDB, SentenceTransformers, Gemini/Ollama adapters.

**Spec:** `PRD.txt`

## Global Constraints

- No endpoint may return demo users, demo documents, fabricated evidence, or fabricated metrics.
- Every document and conversation query must be scoped to the authenticated user.
- The AI service must abstain when evidence or an LLM provider is unavailable.
- PDF, DOCX, TXT, Markdown, and CSV ingestion must preserve source metadata.
- Every answer must expose evidence, agent execution state, consensus, and confidence.
- Verification must run before claiming completion.

### Task 1: Runtime and health contracts

**Files:** backend server/config/health, AI health, runtime scripts.

- [ ] Start frontend, backend, and AI service with the bundled runtimes and capture failures.
- [ ] Make health report `degraded` when MongoDB or AI is unavailable.
- [ ] Fix environment examples and startup validation for production secrets.
- [ ] Verify health endpoints and startup logs.

### Task 2: Persistent backend workflow

**Files:** backend controllers/models/routes/services.

- [ ] Remove all in-memory/demo fallbacks.
- [ ] Enforce ownership checks for documents, conversations, messages, evidence, settings, and analytics.
- [ ] Persist ingestion state transitions and AI failures.
- [ ] Verify TypeScript and API behavior against unavailable dependencies.

### Task 3: Real ingestion and retrieval

**Files:** `ai-service/app/rag`, requirements, API models.

- [ ] Add tested extractors for PDF, DOCX, TXT, Markdown, and CSV.
- [ ] Preserve page/row/section metadata in chunks.
- [ ] Add user-scoped Chroma filters, configurable chunking, top-k, and reranking.
- [ ] Return an explicit abstention response when no evidence is found.

### Task 4: Verification and consensus

**Files:** `ai-service/app/agents`, `consensus`, `api/rag.py`.

- [ ] Implement research, fact verification, trust assessment, and reasoning agents with typed outputs.
- [ ] Add conditional external verification behind configuration.
- [ ] Make consensus derive from agent outputs and evidence, not constants.
- [ ] Add regression tests for unsupported, conflicting, and well-grounded queries.

### Task 5: Frontend API integration

**Files:** frontend API client, auth, upload, knowledge, chat, analytics, settings routes.

- [ ] Remove local demo documents, synthetic metrics, and local-only answer generation from user flows.
- [ ] Add loading, empty, error, retry, upload-processing, and abstention states.
- [ ] Render backend evidence and agent results exactly as returned.
- [ ] Verify routes against a running backend.

### Task 6: Full-stack verification

- [ ] Run frontend TypeScript, lint, production build, backend TypeScript, Python compile, and tests.
- [ ] Run frontend/backend/AI services together.
- [ ] Exercise register, login, upload, ingestion, chat, evidence, analytics, settings, and logout.
- [ ] Document remaining environment-only blockers with exact errors.
