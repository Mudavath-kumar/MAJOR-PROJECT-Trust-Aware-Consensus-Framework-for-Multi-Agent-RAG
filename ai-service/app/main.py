import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.llm_router import get_llm_status
from .api.rag import router as rag_router
from .rag.embeddings import get_embedding_model, is_embedding_model_ready

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the model before advertising readiness. Otherwise the first upload
    # pays the cold-start cost and can time out through the backend gateway.
    await asyncio.to_thread(get_embedding_model)
    yield

app = FastAPI(
    title="TrustRAG AI Service",
    description="Multi-Agent Consensus & Verification Engine (100% Free Stack)",
    version="1.0.0",
    lifespan=lifespan,
)

_ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
# Allow the Render backend service URL if set
if settings.BACKEND_URL:
    _ALLOWED_ORIGINS.append(settings.BACKEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(rag_router)

@app.get("/health")
async def health():
    llm_status = get_llm_status()
    ready = is_embedding_model_ready()
    return {
        "status": "healthy" if ready else "starting",
        "service": "trustrag-ai-service",
        "llm": llm_status,
        "embedding_model": settings.EMBEDDING_MODEL_NAME,
        "vector_store": "MongoDB Atlas Vector Search",
        "ready": ready,
    }

@app.get("/")
async def root():
    return {
        "message": "Welcome to TrustRAG AI Multi-Agent Consensus Service",
        "docs_url": "/docs",
        "health_url": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
