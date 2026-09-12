# TrustRAG — Backend & AI Service Implementation Approaches

> **Status:** Implementation Roadmap — aligned to `PRD.txt`
> **Frontend:** Already built (TanStack Start / React / Tailwind) — this document focuses on **backend** and **AI service** layers.

---

## 0. Quick Reference — What Already Exists

| Layer                       | Status       | Notes                                              |
| --------------------------- | ------------ | -------------------------------------------------- |
| Frontend UI                 | ✅ Done      | TanStack Start, all pages with mock data           |
| API contract shapes         | ✅ Defined   | PRD §43–45; mirrored in `src/lib/trustrag-data.ts` |
| Backend (Node.js/Express)   | ❌ Not built | This document — Phase A                            |
| AI Service (Python/FastAPI) | ❌ Not built | This document — Phase B                            |
| MongoDB schemas             | ❌ Not built | Defined here — Phase A                             |
| ChromaDB integration        | ❌ Not built | Defined here — Phase B                             |

---

## 1. Two-Layer Separation Principle

```
FRONTEND ──HTTP──► BACKEND (Node+Express+TS) ──HTTP──► AI SERVICE (Python+FastAPI)
                           │                                      │
                       MongoDB                               ChromaDB
                    (users, chat,                         (vectors, chunks,
                     metadata,                             embeddings)
                     analytics)
```

**PRD Rule (§10):** The frontend must NOT perform core AI reasoning.
**PRD Rule (§3):** The backend is an API gateway — it does NOT do AI itself.

---

## 2. Phase A — Backend (Node.js + Express + TypeScript)

### 2.1 Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          ← MongoDB connection (Mongoose)
│   │   └── environment.ts       ← env vars with zod validation
│   ├── models/
│   │   ├── User.ts
│   │   ├── Document.ts
│   │   ├── Conversation.ts
│   │   ├── Message.ts
│   │   ├── AgentExecution.ts
│   │   ├── ConsensusResult.ts
│   │   ├── Settings.ts
│   │   └── Feedback.ts
│   ├── middleware/
│   │   ├── auth.ts              ← JWT verify, attach req.user
│   │   ├── validate.ts          ← zod request validation
│   │   ├── rateLimiter.ts       ← express-rate-limit
│   │   └── errorHandler.ts      ← global error → JSON
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── document.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── evidence.controller.ts
│   │   ├── analytics.controller.ts
│   │   └── settings.controller.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── document.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── evidence.routes.ts
│   │   ├── analytics.routes.ts
│   │   └── settings.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── document.service.ts
│   │   ├── chat.service.ts
│   │   ├── ai.service.ts        ← HTTP client wrapper to FastAPI
│   │   └── analytics.service.ts
│   ├── types/
│   │   └── index.ts             ← shared TS interfaces
│   └── server.ts
├── .env.example
└── package.json
```

---

### 2.2 MongoDB Schemas (PRD §41)

#### `users`

```typescript
{
  _id: ObjectId,
  name: string,
  email: string,           // unique, lowercase
  password_hash: string,   // bcrypt saltRounds=12
  role: "user" | "admin",
  created_at: Date,
  updated_at: Date
}
```

#### `documents`

```typescript
{
  _id: ObjectId,
  user_id: ObjectId,       // ref: User
  file_name: string,
  file_type: "PDF"|"DOCX"|"TXT"|"MD"|"CSV",
  file_size: number,       // bytes
  storage_path: string,    // disk path or S3 key
  processing_status: "pending"|"processing"|"ready"|"failed",
  chunk_count: number,
  embedding_status: "pending"|"done"|"failed",
  tags: string[],
  created_at: Date,
  updated_at: Date
}
```

#### `conversations`

```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  title: string,
  created_at: Date,
  updated_at: Date
}
```

#### `messages`

```typescript
{
  _id: ObjectId,
  conversation_id: ObjectId,
  role: "user" | "assistant",
  content: string,
  query_id: string | null,   // links assistant msg to pipeline
  created_at: Date
}
```

#### `agent_executions` (PRD §40)

```typescript
{
  _id: ObjectId,
  query_id: string,
  agent_name: "research"|"fact_verification"|"trust_assessment"|"reasoning"|"external_verification",
  status: "pending"|"running"|"completed"|"failed"|"skipped",
  started_at: Date,
  completed_at: Date,
  duration: number,         // ms
  input_reference: object,
  output: object,
  score: number,            // 0–1
  error: string | null
}
```

#### `consensus_results` (PRD §41)

```typescript
{
  _id: ObjectId,
  query_id: string,
  research_score: number,
  verification_score: number,
  trust_score: number,
  reasoning_score: number,
  external_score: number | null,
  consensus_score: number,
  confidence_score: number,
  decision: "generate"|"abstain"|"external_triggered",
  weights: object,
  created_at: Date
}
```

#### `settings`

```typescript
{
  _id: ObjectId,
  user_id: ObjectId,        // unique per user
  llm_model: string,
  embedding_model: string,
  reranker_model: string,
  top_k: number,
  chunk_size: number,
  chunk_overlap: number,
  similarity_threshold: number,
  consensus_threshold: number,      // default 0.85
  temperature: number,
  external_verification_enabled: boolean
}
```

#### `feedback`

```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  query_id: string,
  rating: 1 | -1,           // thumbs up / down
  comment: string | null,
  created_at: Date
}
```

---

### 2.3 REST API Endpoints (PRD §43)

#### Auth

| Method | Path                 | Auth | Purpose                                |
| ------ | -------------------- | ---- | -------------------------------------- |
| POST   | `/api/auth/register` | —    | Hash password, insert user, return JWT |
| POST   | `/api/auth/login`    | —    | Verify password hash, return JWT       |
| POST   | `/api/auth/logout`   | JWT  | Stateless — client drops token         |
| GET    | `/api/auth/me`       | JWT  | Current user profile                   |

#### Documents

| Method | Path                        | Auth | Purpose                                |
| ------ | --------------------------- | ---- | -------------------------------------- |
| POST   | `/api/documents/upload`     | JWT  | Multipart → disk → queue AI processing |
| GET    | `/api/documents`            | JWT  | User's document list (paginated)       |
| GET    | `/api/documents/:id`        | JWT  | Document metadata                      |
| GET    | `/api/documents/:id/chunks` | JWT  | Proxy chunk list from AI service       |
| DELETE | `/api/documents/:id`        | JWT  | Delete doc + fire AI service delete    |

#### Chat

| Method | Path                          | Auth | Purpose                                         |
| ------ | ----------------------------- | ---- | ----------------------------------------------- |
| POST   | `/api/chat`                   | JWT  | Send query → call AI service → persist → return |
| GET    | `/api/chat/conversations`     | JWT  | List conversations                              |
| GET    | `/api/chat/conversations/:id` | JWT  | Messages in conversation                        |
| DELETE | `/api/chat/conversations/:id` | JWT  | Delete conversation + messages                  |
| POST   | `/api/chat/:id/regenerate`    | JWT  | Re-run pipeline for last message                |

#### Evidence / Agents / Consensus

| Method | Path                      | Auth | Purpose                       |
| ------ | ------------------------- | ---- | ----------------------------- |
| GET    | `/api/evidence/:queryId`  | JWT  | Retrieved chunks for a query  |
| GET    | `/api/agents/:queryId`    | JWT  | Agent execution history       |
| GET    | `/api/consensus/:queryId` | JWT  | Consensus + confidence result |

#### Analytics & Settings

| Method | Path             | Auth | Purpose          |
| ------ | ---------------- | ---- | ---------------- |
| GET    | `/api/analytics` | JWT  | Aggregated stats |
| GET    | `/api/settings`  | JWT  | User settings    |
| PUT    | `/api/settings`  | JWT  | Update settings  |

---

### 2.4 Chat Controller — Core Logic

```typescript
// POST /api/chat
async function chat(req, res) {
  const { conversationId, query } = req.body;
  const userId = req.user._id;

  // 1. Load user settings
  const settings = await Settings.findOne({ user_id: userId });

  // 2. Create unique queryId
  const queryId = `query_${nanoid()}`;

  // 3. Persist user message
  await Message.create({ conversation_id: conversationId, role: "user", content: query });

  // 4. Call AI Service
  const aiResult = await aiService.chat({ query, query_id: queryId, user_id: userId, settings });

  // 5. Persist AI response message
  await Message.create({
    conversation_id: conversationId,
    role: "assistant",
    content: aiResult.answer,
    query_id: queryId,
  });

  // 6. Persist agent executions + consensus
  await AgentExecution.insertMany(aiResult.agent_executions);
  await ConsensusResult.create({ query_id: queryId, ...aiResult.consensus });

  // 7. Return PRD §45 shaped response
  res.json({
    queryId,
    answer: aiResult.answer,
    confidenceScore: aiResult.confidence_score,
    trustScore: aiResult.trust_score,
    consensusScore: aiResult.consensus_score,
    sources: aiResult.sources,
    evidence: aiResult.evidence,
    agentResults: aiResult.agent_results,
    reasoning: aiResult.reasoning,
    externalVerificationTriggered: aiResult.external_triggered,
  });
}
```

---

### 2.5 Document Upload Flow

```
POST /api/documents/upload
    │
    ▼
multer (disk storage, 50 MB max)
    │
    ▼
Validate MIME type + extension whitelist (PDF, DOCX, TXT, MD, CSV)
    │
    ▼
Document.create({ status: "pending" })
    │
    ▼
aiService.processDocument({ doc_id, file_path, user_id, settings })  ← fire-and-forget
    │
    ▼
Return { documentId, status: "processing" } immediately to frontend
    │
    ▼ (async, AI service callbacks)
PATCH /internal/documents/:id/status → update processing_status + chunk_count
```

Frontend polls `GET /api/documents/:id` to watch `processing_status`.

---

### 2.6 Security Implementation

| Concern            | Implementation                                               |
| ------------------ | ------------------------------------------------------------ |
| Passwords          | `bcrypt`, `saltRounds=12`                                    |
| JWT                | `jsonwebtoken`, HS256, 7-day expiry                          |
| Route protection   | `auth.ts` middleware on all `/api/*` except register/login   |
| Rate limiting      | 100 req/15min on auth routes; 300/15min elsewhere            |
| CORS               | `cors({ origin: FRONTEND_URL })`                             |
| File safety        | Extension allowlist; files never served back through Express |
| Document isolation | Every DB query includes `user_id: req.user._id`              |
| Env secrets        | Validated at startup with `zod` — crash early if missing     |

---

## 3. Phase B — AI Service (Python + FastAPI + LangGraph)

### 3.1 Directory Structure

```
ai-service/
├── app/
│   ├── main.py                     ← FastAPI app, routers, lifespan
│   ├── api/
│   │   ├── chat.py                 ← POST /ai/chat
│   │   ├── documents.py            ← process / delete / chunks
│   │   └── health.py
│   ├── rag/
│   │   ├── loader.py               ← PyMuPDF, python-docx, csv
│   │   ├── chunker.py              ← RecursiveCharacterTextSplitter
│   │   ├── embeddings.py           ← BAAI/bge-small-en-v1.5
│   │   ├── retriever.py            ← ChromaDB cosine search
│   │   └── reranker.py             ← BAAI/bge-reranker-base
│   ├── agents/
│   │   ├── research_agent.py
│   │   ├── fact_verification_agent.py
│   │   ├── trust_agent.py
│   │   ├── reasoning_agent.py
│   │   └── external_verification_agent.py
│   ├── consensus/
│   │   ├── consensus_engine.py     ← weighted formula
│   │   ├── confidence.py           ← threshold + decision
│   │   └── thresholds.py           ← defaults
│   ├── graph/
│   │   └── pipeline.py             ← LangGraph StateGraph
│   ├── db/
│   │   └── chroma.py               ← ChromaDB client singleton
│   ├── models/
│   │   └── llm.py                  ← LLM abstraction layer
│   └── utils/
│       ├── logger.py
│       └── timing.py
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

### 3.2 LangGraph Pipeline (`graph/pipeline.py`)

The entire query pipeline is a **LangGraph `StateGraph`**:

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional

class PipelineState(TypedDict):
    query: str
    query_id: str
    user_id: str
    settings: dict
    chunks: list                # top-K reranked evidence chunks
    research_result: dict
    fact_result: dict
    trust_result: dict
    reasoning_result: dict
    consensus: dict
    confidence: float
    external_triggered: bool
    external_result: Optional[dict]
    final_answer: str
    abstained: bool
    cycle_count: int            # max 2 cycles (PRD §27)

graph = StateGraph(PipelineState)

# Nodes
graph.add_node("retrieve",         retrieve_node)
graph.add_node("research",         research_node)
graph.add_node("fact_verify",      fact_verify_node)
graph.add_node("trust_assess",     trust_node)
graph.add_node("reason",           reasoning_node)
graph.add_node("consensus",        consensus_node)
graph.add_node("confidence_check", confidence_check_node)
graph.add_node("external_verify",  external_verify_node)
graph.add_node("generate",         generate_node)
graph.add_node("abstain",          abstain_node)

# Flow:
# retrieve → research
#          → [fact_verify, trust_assess, reason]  (parallel via Send API)
#          → consensus → confidence_check
#                     → HIGH → generate
#                     → LOW  → external_verify → consensus → generate/abstain
```

> **Parallel agents:** Use LangGraph's `Send` API to fan-out fact, trust, and reasoning agents simultaneously after research completes. This cuts latency significantly.

---

### 3.3 Document Processing Pipeline

```
POST /ai/documents/process
    │
    ▼
loader.py — extract text by file type:
  PDF  → PyMuPDF (fitz) — page-by-page, preserve page_number
  DOCX → python-docx — paragraph + heading structure
  TXT/MD → plain read, preserve sections
  CSV  → pandas → row-per-record with column metadata
    │
    ▼
chunker.py — RecursiveCharacterTextSplitter
  chunk_size:    700–1000 tokens  (user-configurable)
  chunk_overlap: 100–150 tokens   (user-configurable)
  Each chunk → { chunk_id, document_id, user_id,
                 page_number, section, chunk_index, text }
    │
    ▼
embeddings.py — BAAI/bge-small-en-v1.5
  model.encode(texts, batch_size=32, normalize_embeddings=True)
    │
    ▼
chroma.py — collection.add(
  documents=texts,
  embeddings=vectors,
  ids=chunk_ids,
  metadatas=[{ document_id, user_id, page_number, ... }]
)
    │
    ▼
Callback → PATCH /internal/documents/:id/status
           { status: "ready", chunk_count: N }
```

---

### 3.4 Query Retrieval Pipeline

```python
# retriever.py
def retrieve(query, user_id, top_k=20):
    q_vec = embed_model.encode([query], normalize_embeddings=True)[0]
    results = collection.query(
        query_embeddings=[q_vec.tolist()],
        n_results=top_k,
        where={"user_id": user_id}     # user isolation (PRD §42)
    )
    return results

# reranker.py
def rerank(query, candidates, top_n=8):
    pairs = [(query, c["text"]) for c in candidates]
    scores = cross_encoder.predict(pairs)
    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    return [c for c, _ in ranked[:top_n]]
```

---

### 3.5 The Four Agents

#### Research Agent

```python
SYSTEM = """
You are a Research Agent. From the question and evidence chunks,
extract key facts, entities, and statements. Map each fact to its source chunk.

Return JSON:
{
  "facts": [...],
  "entities": [...],
  "evidence_references": [...],
  "research_score": 0.0-1.0,
  "summary": "..."
}
"""
```

#### Fact Verification Agent

```python
SYSTEM = """
You are a Fact Verification Agent. For each claim check against evidence.
Label: SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | CONTRADICTED

Return JSON:
{
  "verified_claims": [...],
  "unsupported_claims": [...],
  "contradicted_claims": [...],
  "verification_score": 0.0-1.0,   // supported / total
  "evidence_mapping": { claim: [chunk_ids] }
}
"""
```

`verification_score = supported_count / total_claims` (PRD §28)

#### Trust Assessment Agent

```python
# Rule-based heuristic + optional LLM for ambiguous sources
SOURCE_TRUST = {
    "official_documentation": 0.95,
    "government":             0.90,
    "academic":               0.85,
    "known_reference":        0.75,
    "unknown":                0.50,
}

def assess_trust(chunks):
    scores = []
    for chunk in chunks:
        source_type = classify_source(chunk["metadata"]["file_name"])
        freshness   = freshness_weight(chunk["metadata"])
        scores.append(SOURCE_TRUST[source_type] * freshness)
    return {
        "source_scores": scores,
        "overall_trust_score": mean(scores),
        "trust_explanation": "..."
    }
```

#### Reasoning Agent

```python
SYSTEM = """
You are a Reasoning Agent. Evaluate logical consistency of the evidence.
Detect: agreements, contradictions, missing information, logical gaps.

Return JSON:
{
  "consistency": "consistent" | "minor_conflict" | "major_conflict",
  "contradictions": [...],
  "missing_info": [...],
  "reasoning_score": 0.0-1.0,
  "reasoning_summary": "..."
}
"""
```

---

### 3.6 Adaptive Consensus Engine (PRD §25–26)

```python
# consensus/consensus_engine.py

DEFAULT_WEIGHTS = {
    "w1": 0.20,   # evidence quality  (research)
    "w2": 0.30,   # claim verification (fact)
    "w3": 0.20,   # source trust       (trust)
    "w4": 0.20,   # logical reasoning  (reasoning)
    "w5": 0.10,   # external evidence  (0 if not triggered)
}

def calculate_consensus(research, fact, trust, reasoning,
                         external=None, weights=None):
    w = weights or DEFAULT_WEIGHTS
    ew = w["w5"] if external else 0.0
    total_w = w["w1"] + w["w2"] + w["w3"] + w["w4"] + ew

    consensus = (
        w["w1"] * research["research_score"]  +
        w["w2"] * fact["verification_score"]  +
        w["w3"] * trust["overall_trust_score"]+
        w["w4"] * reasoning["reasoning_score"]+
        ew      * (external["score"] if external else 0.0)
    ) / total_w

    return {
        "consensus_score": round(consensus, 4),
        "individual_scores": { ... },
        "weights_used": w
    }
```

> **Note (PRD §29):** Weights `w1–w5` are prototype parameters. Experimentally tune via ablation study.

---

### 3.7 Confidence Decision & External Verification Trigger (PRD §27–30)

```python
# consensus/confidence.py

def decide(consensus_score, settings, cycle_count) -> str:
    threshold  = settings.get("consensus_threshold", 0.85)
    max_cycles = 2    # PRD §27 — prevent infinite loops

    if consensus_score >= threshold:
        return "generate"

    if not settings.get("external_verification_enabled", True):
        return "abstain"

    if cycle_count >= max_cycles:
        return "generate_or_abstain"

    return "external_verify"
```

#### External Verification Trigger Conditions (any one):

- `confidence < threshold`
- `contradicted_claims > 0`
- `overall_trust_score < 0.60`
- `reasoning.consistency == "major_conflict"`

```python
# agents/external_verification_agent.py
async def external_verify(query, context):
    results = await tavily.search(query, max_results=5)
    # Filter to trusted domains only (PRD §24)
    trusted = [r for r in results if is_trusted_domain(r["url"])]
    external_chunks = [
        {
            "source_url":          r["url"],
            "title":               r["title"],
            "domain":              urlparse(r["url"]).netloc,
            "source_type":         classify_domain(r["url"]),
            "retrieved_at":        now(),
            "content_reference":   r["content"],
            "external_trust_score": score_domain(r["url"])
        }
        for r in trusted
    ]
    return {
        "external_chunks": external_chunks,
        "score": mean([c["external_trust_score"] for c in external_chunks]),
        "triggered": True
    }
```

---

### 3.8 Final Answer Generator

```python
# rag/generator.py

ANSWER_PROMPT = """
You are a helpful, evidence-grounded AI assistant.
Answer using ONLY the provided evidence. Do NOT add unsupported information.
If evidence is insufficient, state that clearly.

Question: {query}
Evidence: {validated_chunks}
Confidence: {confidence_score}

Reference sources as [1], [2], etc.
"""

ABSTAIN_PROMPT = """
The available evidence is insufficient or contains unresolved conflicts.
Explain what was found and why a reliable answer cannot be established.

Question: {query}
Conflict Summary: {conflict_summary}
Confidence: {confidence_score}
"""
```

---

### 3.9 ChromaDB Setup

```python
# db/chroma.py
import chromadb

client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

def get_collection():
    return client.get_or_create_collection(
        name="trustrag_documents",
        metadata={"hnsw:space": "cosine"}
    )
```

**User isolation:** Every query includes `where={"user_id": user_id}` — users never see each other's chunks (PRD §42).

---

### 3.10 LLM Abstraction Layer (PRD §17)

```python
# models/llm.py
from langchain_community.llms import Ollama
from langchain_openai import ChatOpenAI

def get_llm(model_name: str, temperature: float = 0.1):
    if model_name.startswith(("llama", "qwen", "gemma", "mistral")):
        return Ollama(model=model_name, temperature=temperature)
    elif model_name.startswith("gpt"):
        return ChatOpenAI(model=model_name, temperature=temperature)
    else:
        return Ollama(model=model_name, temperature=temperature)
```

Swap between **Llama 3.1 8B (local via Ollama)**, **Qwen**, **Gemma**, or cloud without changing agent code.

---

## 4. API Contract — Full Data Flow

### Frontend → Backend

```json
POST /api/chat
{ "conversationId": "conv_abc", "query": "What is the relapse rate?" }
```

### Backend → AI Service

```json
POST /ai/chat
{
  "query": "What is the relapse rate?",
  "query_id": "query_xyz",
  "user_id": "user_001",
  "settings": {
    "top_k": 8, "chunk_size": 800,
    "consensus_threshold": 0.85, "temperature": 0.1,
    "external_verification_enabled": true,
    "llm_model": "llama3.1:8b"
  }
}
```

### AI Service → Backend

```json
{
  "answer": "The Phase III trial reports a 31% reduction...",
  "confidence_score": 93, "trust_score": 91, "consensus_score": 94,
  "sources": [{ "file_name": "trial.pdf", "page": 42, "chunk_id": "c1" }],
  "evidence": [...],
  "agent_results": {
    "research":          { "research_score": 0.92, "summary": "..." },
    "fact_verification": { "verification_score": 0.95, "verified_claims": [...] },
    "trust_assessment":  { "overall_trust_score": 0.91, "source_scores": [...] },
    "reasoning":         { "reasoning_score": 0.88, "consistency": "consistent" }
  },
  "reasoning": "Multiple reliable sources agree.",
  "external_triggered": false,
  "agent_executions": [...],
  "timing": { "retrieval_ms": 120, "agents_ms": 2400, "total_ms": 4370 }
}
```

### Backend → Frontend (PRD §45 shape)

```json
{
  "queryId": "query_xyz",
  "answer": "The Phase III trial reports a 31% reduction...",
  "confidenceScore": 93, "trustScore": 91, "consensusScore": 94,
  "sources": [...], "evidence": [...], "agentResults": [...],
  "reasoning": "Multiple reliable sources agree.",
  "externalVerificationTriggered": false
}
```

---

## 5. Environment Variables

### `backend/.env`

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/trustrag
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50
```

### `ai-service/.env`

```env
PORT=8000
CHROMA_URL=http://localhost:8010
LLM_MODEL=llama3.1:8b
LLM_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
RERANKER_MODEL=BAAI/bge-reranker-base
TAVILY_API_KEY=tvly-xxxx
BACKEND_INTERNAL_URL=http://localhost:3001
```

---

## 6. Docker Compose (PRD §58)

```yaml
version: "3.9"
services:
  frontend:
    build: ./trustarc-core
    ports: ["5173:5173"]
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["3001:3001"]
    env_file: ./backend/.env
    depends_on: [mongodb]
    volumes:
      - ./uploads:/app/uploads

  ai-service:
    build: ./ai-service
    ports: ["8000:8000"]
    env_file: ./ai-service/.env
    depends_on: [chromadb]

  mongodb:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]

  chromadb:
    image: chromadb/chroma:latest
    ports: ["8010:8000"]
    volumes: [chroma_data:/chroma/chroma]

volumes:
  mongo_data:
  chroma_data:
```

---

## 7. Phased Development Roadmap

| Phase  | Build                                            | Why This Order                      |
| ------ | ------------------------------------------------ | ----------------------------------- |
| **A1** | Backend: auth + MongoDB models                   | Everything needs auth first         |
| **A2** | Backend: document upload endpoint                | Need docs before AI can process     |
| **B1** | AI: loader + chunker + embedder + ChromaDB       | Core document pipeline              |
| **B2** | AI: retriever + reranker                         | Need retrieval before agents        |
| **B3** | AI: baseline RAG (no agents yet)                 | Research baseline (PRD §72 Phase 3) |
| **B4** | AI: 4 agents (research, fact, trust, reasoning)  | Multi-agent layer                   |
| **B5** | AI: consensus engine + confidence threshold      | Decision layer                      |
| **B6** | AI: external verification agent                  | Conditional enhancement             |
| **B7** | AI: LangGraph StateGraph wiring all nodes        | Full pipeline integration           |
| **A3** | Backend: chat endpoint (calls AI service)        | Wire real AI to API                 |
| **A4** | Backend: analytics + evidence + agents endpoints | Expose stored results               |
| **C1** | Frontend: swap mock data → real API calls        | End-to-end integration              |
| **C2** | Evaluation: baseline RAG vs TrustRAG benchmark   | Research contribution               |

---

## 8. Key Design Decisions

| Decision                | Choice                      | Rationale                                                      |
| ----------------------- | --------------------------- | -------------------------------------------------------------- |
| Agent orchestration     | LangGraph StateGraph        | Conditional branches, parallel nodes, cycle detection built-in |
| Parallel agents         | LangGraph `Send` API        | Fact + Trust + Reasoning fan-out in parallel → lower latency   |
| Embedding               | `BAAI/bge-small-en-v1.5`    | Lightweight, high-quality, runs locally without GPU            |
| Reranker                | `BAAI/bge-reranker-base`    | Cross-encoder beats bi-encoder for evidence relevance          |
| LLM                     | Llama 3.1 8B via Ollama     | Local, free, instruction-tuned, no API costs in dev            |
| Vector DB               | ChromaDB                    | Simple, file-backed, zero infrastructure in dev                |
| User isolation          | `where` filter on `user_id` | Metadata filter vs. per-user collection — better scale         |
| External search         | Tavily API                  | Academic/official source bias built-in; generous free tier     |
| Consensus formula       | Weighted sum `w1–w5`        | Prototype; tune weights via ablation study (PRD §63)           |
| Max verification cycles | 2                           | PRD §27 — prevents infinite loops and runaway latency          |
| Confidence threshold    | 0.85 default, configurable  | PRD §30; user can relax for more liberal generation            |

---

## 9. Frontend Integration Checklist

Files that currently use mock data and need real API wiring:

| File                           | Mock Data Source                  | Real API Endpoint               |
| ------------------------------ | --------------------------------- | ------------------------------- |
| `src/routes/app.chat.tsx`      | `AGENT_STEPS`, `ANSWER`, `CHUNKS` | `POST /api/chat`                |
| `src/routes/app.upload.tsx`    | Hardcoded file presets            | `POST /api/documents/upload`    |
| `src/routes/app.knowledge.tsx` | `DOCUMENTS` from trustrag-data    | `GET /api/documents`, `/chunks` |
| `src/routes/app.analytics.tsx` | `QUERIES_PER_DAY`, `LATENCY`      | `GET /api/analytics`            |
| `src/routes/app.settings.tsx`  | Local state                       | `GET/PUT /api/settings`         |
| `src/routes/app.index.tsx`     | Dashboard stats                   | `GET /api/analytics`            |
| `src/routes/login.tsx`         | —                                 | `POST /api/auth/login`          |
| `src/routes/signup.tsx`        | —                                 | `POST /api/auth/register`       |
| `src/lib/trustrag-data.ts`     | Static exports                    | Delete after API wired          |
| `src/lib/doc-store.ts`         | In-memory store                   | Replace with service calls      |

---

## 10. Research Evaluation Plan (PRD §60–65)

Once the pipeline is built:

1. **Baseline** — Phase B3 bare RAG (retrieve + LLM, no agents)
2. **Dataset** — TriviaQA / HotpotQA / MS-MARCO or domain-specific custom set
3. **Metrics:**
   - Accuracy (correct / total)
   - Groundedness (claim ↔ evidence alignment)
   - Hallucination Rate
   - Retrieval Quality (Recall@K, Precision@K, NDCG)
   - Confidence Calibration (ECE, Brier Score)
   - Latency (retrieval, agents, consensus, total)
4. **Ablation study** — incrementally add each component (PRD §63)
5. **Confidence calibration** — bucket predictions vs. actual correctness (PRD §65)
6. **External verification experiment** — always-on vs. adaptive (PRD §64)

---

_Start with **Phase A1** (auth + MongoDB) and **Phase B1** (document pipeline) in parallel. Each phase produces a testable artifact before the next begins._
