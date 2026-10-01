# TrustRAG backend and AI service

This document describes the runtime that is actually deployed by this repository.

## Runtime architecture

```text
Browser (TanStack Start / React)
        │ authenticated REST calls
        ▼
Express backend (Node.js / TypeScript)
  ├─ Clerk or local JWT authentication
  ├─ MongoDB metadata, conversations, audits
  ├─ Backblaze B2 object storage
  └─ authenticated internal calls
        ▼
FastAPI AI service (Python)
  ├─ document extraction and chunking
  ├─ Gemini Embedding 2 vectors
  ├─ MongoDB Atlas Vector Search
  ├─ Gemini or OpenRouter agent calls
  ├─ optional Tavily verification
  └─ fail-closed consensus/evidence response
```

The AI service does not use ChromaDB, Hugging Face BGE embeddings, Ollama, or a
local answer fallback. Those names remain in the original PRD as alternative
design ideas, but they are not dependencies of the current implementation.

## Local prerequisites

- Node.js 20+
- pnpm (or npm for the backend)
- Python 3.11+
- MongoDB Atlas with an Atlas Vector Search index, or a compatible local MongoDB
- Clerk credentials for browser authentication
- Gemini and/or OpenRouter credentials
- Backblaze B2 S3 credentials for document storage

The frontend runs on `http://localhost:5174`, the backend on
`http://localhost:3001`, and the AI service on `http://localhost:8000`.

## Configuration

Copy the examples and fill values locally:

```text
backend/.env.example    -> backend/.env
ai-service/.env.example -> ai-service/.env
frontend values         -> .env.local
```

The backend and AI service must share the same long random `AI_SERVICE_TOKEN`.
Production also requires a separate `SETTINGS_ENCRYPTION_KEY`; it is used to
encrypt provider keys saved through the Settings screen. Never commit any
`.env` file or API key.

Important AI values:

```env
GEMINI_MODEL=gemini-3.8-flash
EMBEDDING_MODEL_NAME=gemini-embedding-2
MONGODB_URI=mongodb+srv://...
```

The Atlas vector index is named `embedding_index`, uses the `embedding` field,
cosine similarity, and 384 dimensions. If the embedding dimension is changed,
the index and all stored vectors must be rebuilt together.

## Start locally

Terminal 1 — AI service:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2 — backend:

```powershell
cd backend
npm install
npm run dev
```

Terminal 3 — frontend:

```powershell
pnpm install
pnpm run dev
```

Before using upload or chat, verify:

```text
GET http://localhost:8000/health        -> status healthy, ready true
GET http://localhost:3001/api/v1/health -> status healthy, ready true
```

The backend deliberately reports `ready: false` when MongoDB or the AI service
is unavailable. Uploads, retrieval, and answers do not silently fall back to
local demo data.

## End-to-end data flow

1. The authenticated browser uploads a file to the backend.
2. The backend validates ownership, stores the object in Backblaze B2, and
   creates a MongoDB document with `chunking` status.
3. The backend sends the file bytes over the authenticated internal channel to
   the AI service.
4. The AI service extracts text, chunks it, computes Gemini embeddings, and
   writes tenant-scoped chunks to MongoDB Atlas.
5. Only after ingestion succeeds does the backend mark the document `ready`.
   Failed ingestion removes the B2 object and marks the document `failed`.
6. Chat verifies every selected document belongs to the authenticated user
   before the AI service receives the query.
7. Retrieval applies both `user_id` and selected document filters.
8. Agents produce researcher, fact-checker, critic, trust, and reasoner output.
   Consensus returns evidence and measured scores only when the required data
   exists; otherwise the response is failed or evidence-free.
9. The backend persists the conversation and audit records, and the frontend
   renders only those server responses.

## Production deployment

`render.yaml` provisions the backend and AI services. Deploy the frontend on
Vercel using `vercel.json`. Set these values in the platform secret manager:

- `MONGODB_URI`
- `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY`
- the same `AI_SERVICE_TOKEN` in both services
- `SETTINGS_ENCRYPTION_KEY` in the backend
- `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, and
  `B2_BUCKET_NAME`
- `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `FRONTEND_URL`, and
  `CORS_ALLOWED_ORIGINS`
- Vercel `VITE_API_URL` pointing to the HTTPS backend API

Rotate any credential that was ever pasted into chat, a terminal transcript, or
source control before production deployment.
