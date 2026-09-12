# TrustRAG — Backend & AI Service Architecture & Quickstart

> **Status:** Fully Implemented (Node.js/Express Backend + Python FastAPI AI Service)  
> **Cost:** 100% Free Tier Stack (No Credit Card / Zero Subscriptions Required)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (TanStack / Vite)                │
│                   Runs on: http://localhost:8080            │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST
┌──────────────────────────────▼──────────────────────────────┐
│             BACKEND GATEWAY (Node.js + Express)             │
│                   Runs on: http://localhost:3001            │
│  - User Auth & JWT Sessions                                 │
│  - Document upload / metadata management                    │
│  - Chat history persistence                                 │
│  - Evidence & Audit trail export                            │
│  - Analytics aggregator                                     │
│  - Database: MongoDB (Atlas Free Tier or Local)             │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON
┌──────────────────────────────▼──────────────────────────────┐
│           AI CONSENSUS ENGINE (Python + FastAPI)            │
│                   Runs on: http://localhost:8000            │
│  - Vector Store: ChromaDB (Local file-based, 100% free)     │
│  - Embeddings: BAAI/bge-small-en-v1.5 (Local, 0 API cost)   │
│  - Agent 1: Evidence Retriever & Synthesizer                │
│  - Agent 2: Independent Fact-Checker (External validation)  │
│  - Agent 3: Hallucination & Consistency Auditor (Critic)    │
│  - Multi-Agent Consensus Matrix & Confidence Scorer (0-100) │
│  - LLM: Groq Free Tier (Llama 3.3 70B @ 500 tok/s)          │
│         or Offline Ollama (Llama 3.1)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Free Stack Details (0 Cost Guaranteed)

| Component              | Free Technology Used                 | Why Chosen                                                                |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| **LLM Inference**      | **Groq API** (Free Tier)             | Blazing fast (500 tokens/sec), free Llama 3.3 70B & 8B, no card required. |
| **Local LLM Fallback** | **Ollama**                           | 100% offline, private, zero cost.                                         |
| **Embeddings**         | `BAAI/bge-small-en-v1.5`             | Top MTEB leaderboard benchmark, runs locally via sentence-transformers.   |
| **Vector DB**          | **ChromaDB**                         | Embedded local persistence (`./chroma_db`), zero setup fee or cloud cost. |
| **Database**           | **MongoDB Atlas (M0 Free)** or Local | 512 MB free storage forever, ideal for auth and chat history.             |
| **Web Search**         | **Tavily API** (Free Tier)           | 1,000 free search queries/month, clean markdown extraction.               |

---

## 🚀 How to Run the Services

### 1. Run the Frontend (Already Running)

```bash
bun run dev
# Running at: http://localhost:8080
```

### 2. Run the Express Backend

Open a terminal in `Major-Project/trustarc-core`:

```bash
# Navigate to backend and install dependencies
cd backend
npm install

# Start development server
npm run dev
# Backend runs at: http://localhost:3001
# Health check: http://localhost:3001/api/v1/health
```

### 3. Run the Python AI Service

Open a second terminal in `Major-Project/trustarc-core`:

```bash
# Navigate to ai-service
cd ai-service

# Create virtual environment (optional but recommended)
python -m venv venv
# On Windows:
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
# AI Service runs at: http://localhost:8000
# Swagger Docs: http://localhost:8000/docs
```

---

## 🔑 Obtaining Free API Keys (Quick Links)

1. **Groq API Key (Free):**
   - Visit [console.groq.com](https://console.groq.com/keys)
   - Create a free account (Google/GitHub login, no credit card required)
   - Click "Create API Key" and paste it into `ai-service/.env` or in the TrustRAG Settings UI.

2. **Tavily Search API Key (Free, Optional):**
   - Visit [tavily.com](https://tavily.com)
   - Sign up for 1,000 free searches/month.
   - Paste into `ai-service/.env` or the Settings page.

3. **MongoDB Atlas (Free, Optional):**
   - Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas/database) for a free M0 cluster.
   - Paste the connection string into `backend/.env`.
   - _Note:_ The backend features an intelligent in-memory fallback, so it runs immediately even without MongoDB running!

---

## 🛡️ Multi-Agent Verification Flow

1. **User asks a question** in TrustRAG Chat.
2. **Backend gateway** forwards query to FastAPI AI engine.
3. **Retrieval phase**: ChromaDB retrieves highest-similarity chunks using `bge-small-en-v1.5`.
4. **Agent 1 (Retriever)** forms grounded claims and synthesizes direct response.
5. **Agent 2 (Fact-Checker)** evaluates propositions against external domain truth.
6. **Agent 3 (Critic)** audits for hallucinations, unsupported leaps, and contradiction.
7. **Consensus Engine**:
   - Calculates weighted consensus score (0-100%).
   - Flags dissenting claims with granular conflict resolution.
   - Attaches verified source citations with exact page numbers.
8. **Frontend displays** the live timeline, confidence gauge, agent consensus status, and clickable evidence citations.
