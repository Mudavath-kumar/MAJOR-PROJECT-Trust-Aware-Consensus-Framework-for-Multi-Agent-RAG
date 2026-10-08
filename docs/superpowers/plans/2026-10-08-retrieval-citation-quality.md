# Retrieval and Citation Quality Implementation Plan

> **For agentic workers:** Execute each task in order. Steps use checkbox syntax for tracking.

**Goal:** Deploy tested retrieval filtering, preserve PDF page citations for newly indexed files, and correct misleading chat copy.

**Architecture:** Keep ranking eligibility in the existing AI-service retrieval path, keep PDF page extraction/chunk metadata in the existing AI RAG utilities, and keep presentation wording in the chat route. Do not migrate or mutate existing production documents.

**Tech Stack:** Python, FastAPI, MongoDB Atlas Vector Search, pytest, TypeScript, React, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-retrieval-citation-quality.md`

## Global Constraints

- Follow the required behavior and constraints in the linked specification.
- Keep unrelated working-tree changes unstaged and uncommitted.
- Run the focused regression tests before committing; run frontend typecheck/build before pushing.

---

### Task 1: Enforce the relevance gate across vector retrieval paths

**Files:**
- Modify: `ai-service/app/rag/vectorstore.py`
- Create: `ai-service/tests/test_retrieval_quality_gate.py`

**Interfaces:**
- Consumes: `filter_vector_results(results, query_text, top_k)` in `ai-service/app/rag/relevance.py`.
- Produces: `query_vector_store(...)` returns only candidates allowed by the relevance gate for a specific query.

- [x] Test Atlas and forced-fallback retrieval with a matching primary/foreign-key passage and an unrelated SSE/WebSocket passage; confirm the fallback originally returned both.
- [x] Keep the existing Atlas relevance gate and apply it to the ranked fallback results without changing tenant/document filters.
- [x] Re-run retrieval-quality and vector-store scope tests.

### Task 2: Preserve original page numbers for PDF chunks

**Files:**
- Modify: `ai-service/app/rag/chunker.py`
- Modify: `ai-service/app/api/rag.py`
- Modify: `ai-service/app/agents/researcher.py`
- Create: `ai-service/tests/test_pdf_page_metadata.py`

**Interfaces:**
- Consumes: page text extracted from each PDF page in document order.
- Produces: PDF chunks whose metadata includes a one-based `page`; non-PDF chunks remain unpaginated.

- [x] Add tests for multiple chunks per PDF page, blank-page numbering, page-preserving extraction, and unpaginated text.
- [x] Add page-preserving PDF extraction/chunking and call it only for PDF ingestion; keep the existing text extraction path for other formats.
- [x] Make researcher citations pass through missing page metadata as unavailable rather than `0`.
- [x] Re-run focused page-metadata and vector-store tests. The async RAG pipeline test could not run in this Windows sandbox: faulthandler showed the process stalled while asyncio created its Proactor event-loop socket pair.

### Task 3: Correct chat claims about verification

**Files:**
- Modify: `src/routes/app.chat.tsx`

**Interfaces:**
- Consumes: the existing evidence and recorded agent activity shown by the chat view.
- Produces: concise interface copy that makes no independence or correctness guarantee.

- [x] Replace the hardcoded “3 independent agents” and “verified answer” assertions with accurate copy about retrieved citations and recorded checks.
- [x] Run targeted ESLint and frontend typecheck; the production frontend build completed successfully.

### Task 4: Verify and publish only this fix

**Files:**
- Stage only the files listed in Tasks 1–3 and their tests.

- [x] Run AI-service focused pytest tests (10 passed), targeted ESLint, frontend typecheck, `git diff --check`, and frontend production build.
- [ ] Review the staged diff and confirm no unrelated changes or secrets are included.
- [ ] Commit and push the scoped fix to `origin/main`; do not trigger a production document re-ingestion.
- [ ] Verify the public health endpoints and the deployed UI markers; report that existing PDFs need re-ingestion for page citations.
