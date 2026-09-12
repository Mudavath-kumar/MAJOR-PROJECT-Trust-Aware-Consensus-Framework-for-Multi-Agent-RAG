# TrustRAG — Enterprise Evidence-First AI Platform

> Multi-agent RAG consensus system with real-time evaluation matrices, audit trails, and Clerk authentication.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## What is TrustRAG?

TrustRAG is an enterprise-grade Retrieval-Augmented Generation (RAG) platform that:

- **Runs 5 concurrent AI agents** (Retriever, Fact-Checker, Critic, Trust Assessor, Reasoner)  
- **Computes a RAG Evaluation Matrix** for every query: Faithfulness, Context Precision, Answer Relevance, Hallucination Risk, Consensus Alignment  
- **Enforces strict user data isolation** — all ChromaDB collections and MongoDB documents are scoped to `user_id`  
- **Provides an Audit Trail** with compliance-ready JSON/CSV exports  
- **Supports multi-file upload** of PDF, DOCX, TXT, Markdown, CSV (up to 10 files × 25 MB each)

---

## Architecture

```
┌─────────────────────────────────┐
│        React Frontend           │
│  TanStack Start + Clerk Auth    │
│  Port 3000 (dev) / Render       │
└──────────────┬──────────────────┘
               │ REST API (Bearer + x-user-email)
┌──────────────▼──────────────────┐
│       Express Backend           │
│  MongoDB + Clerk JWT validation │
│  Port 3001 (dev) / Render       │
└──────────────┬──────────────────┘
               │ HTTP (AI_SERVICE_URL)
┌──────────────▼──────────────────┐
│       FastAPI AI Service        │
│  ChromaDB + BAAI embeddings     │
│  5-Agent consensus pipeline     │
│  Port 8000 (dev) / Render       │
└─────────────────────────────────┘
```

---

## Local Development

### Prerequisites

- **Node.js 20+** and **Bun** (frontend + backend)
- **Python 3.11+** with pip (AI service)
- **MongoDB** (local or Atlas)
- Clerk account with API keys

### 1. Clone and install

```bash
git clone <your-repo-url>
cd trustarc-core

# Frontend + root dependencies
bun install

# Backend
cd backend && npm install && cd ..

# AI Service
cd ai-service && pip install -r requirements.txt && cd ..
```

### 2. Configure environment variables

**Root `.env.local`** (frontend):
```env
VITE_API_URL=http://localhost:3001/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**`backend/.env`**:
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/trustrag
JWT_SECRET=your-super-secret-jwt-key
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

**`ai-service/.env`** (or environment variables):
```env
GOOGLE_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
CHROMA_DB_PATH=./chroma_db
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

### 3. Run all services

Open 3 terminals:

```bash
# Terminal 1 — Frontend
bun run dev

# Terminal 2 — Backend
cd backend && npm run dev

# Terminal 3 — AI Service
cd ai-service && uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:3000 — sign in with Clerk, upload docs, start querying.

---

## Deployment to Render (One Click)

### Prerequisites

1. [MongoDB Atlas free cluster](https://www.mongodb.com/atlas) — get a connection string
2. [Clerk account](https://clerk.com) — get publishable key and secret key
3. (Optional) Google Gemini/Groq/OpenRouter API keys for AI agents

### Steps

1. **Fork** this repository to your GitHub account
2. Click the **Deploy to Render** button at the top of this README
3. Render will detect `render.yaml` and create 3 services automatically
4. **Set the following environment variables** in the Render dashboard for each service:

#### `trustrag-ai-service` (Docker service)
| Variable | Value |
|---|---|
| `GOOGLE_API_KEY` | Your Google AI Studio API key |
| `GROQ_API_KEY` | Your Groq API key |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |

#### `trustrag-backend` (Node service)
| Variable | Value |
|---|---|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `CLERK_SECRET_KEY` | `sk_live_...` from Clerk dashboard |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` from Clerk dashboard |

#### `trustrag-frontend` (Node service)
| Variable | Value |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` from Clerk dashboard |

5. **Configure Clerk** for production:
   - Add your Render frontend URL to Clerk's allowed origins
   - Add your Render backend URL to Clerk's allowed origins
   - Set `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup` in Clerk dashboard

6. Deploy all services — the AI service takes ~5 minutes on first deploy (builds PyTorch image)

> **Note:** The AI service uses a 10 GB persistent disk for ChromaDB vector storage. This persists across deploys.

---

## RAG Evaluation Matrix

Every AI chat response includes a 5-point evaluation matrix:

| Metric | Description | Range |
|---|---|---|
| **Faithfulness** | % of answer propositions grounded in retrieved context | 0–100% |
| **Context Precision** | Average cosine similarity of retrieved chunks to query | 0–100% |
| **Answer Relevance** | Semantic relevance of answer to the original query | 0–100% |
| **Hallucination Risk** | Derived from critic agent + semantic entropy | low/medium/high |
| **Composite Confidence** | Weighted combination of all metrics | 0–100% |

View the full matrix by clicking **"RAG Eval"** on any assistant message in the chat interface. Export the full audit trail from the **Evaluations** page.

---

## Security

- **User data isolation**: All MongoDB queries and ChromaDB vector searches are scoped to `user_id`
- **File upload hardening**: Strict MIME type + extension allowlist, 25 MB limit, path traversal prevention
- **Rate limiting**: Global Express rate limiter on all API routes
- **Helmet.js**: Secure HTTP headers on all responses
- **CORS**: Strict origin allowlist in production mode
- **Clerk JWT**: All API routes require valid Clerk Bearer token

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TanStack Router/Start, TypeScript, Lucide React |
| Auth | Clerk (OAuth + JWT) |
| Backend | Node.js, Express, Mongoose, TypeScript |
| Database | MongoDB Atlas |
| AI Service | Python 3.11, FastAPI, ChromaDB |
| Embeddings | `BAAI/bge-small-en-v1.5` via SentenceTransformers |
| AI Models | Google Gemini / Groq LLaMA / OpenRouter |
| Storage | Backblaze B2 (optional, graceful fallback) |
| Deployment | Render Blueprint (`render.yaml`) |
