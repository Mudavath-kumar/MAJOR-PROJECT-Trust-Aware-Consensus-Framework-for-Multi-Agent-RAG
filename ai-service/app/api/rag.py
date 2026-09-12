import os
import asyncio
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..rag.chunker import chunk_text, extract_text_from_file
from ..rag.embeddings import compute_embeddings
from ..rag.vectorstore import (
    add_document_chunks,
    delete_document_chunks,
    get_document_chunks,
    query_vector_store,
)
from ..agents.researcher import run_researcher
from ..agents.fact_checker import run_fact_checker
from ..agents.critic import run_critic
from ..agents.reasoner import run_reasoner
from ..agents.trust_assessor import assess_trust
from ..consensus.engine import compute_multi_agent_consensus
from ..core.config import settings

logger = logging.getLogger("trustrag.api.rag")
router = APIRouter(prefix="/rag", tags=["RAG"])

class QueryRequest(BaseModel):
    query: str
    conversation_id: str
    user_id: str
    document_ids: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None

class IngestRequest(BaseModel):
    document_id: str
    filename: str
    file_path: str
    mime_type: Optional[str] = ""
    user_id: str

class DeleteDocumentRequest(BaseModel):
    user_id: str

@router.post("/ingest")
async def ingest_document(req: IngestRequest):
    try:
        raw_text = extract_text_from_file(req.file_path, req.mime_type or "")
        if not raw_text.strip():
            raise ValueError("Document contains no extractable text")

        chunks = chunk_text(
            text=raw_text,
            chunk_size=400,
            chunk_overlap=80,
            doc_metadata={
                "document_id": req.document_id,
                "document_name": req.filename,
                "user_id": req.user_id,
            }
        )

        texts = [c["text"] for c in chunks]
        embeddings = compute_embeddings(texts)
        ids = [f"{req.document_id}_{c['chunk_id']}" for c in chunks]
        metas = [c["metadata"] for c in chunks]

        add_document_chunks(
            chunk_ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metas
        )

        return {
            "status": "ready",
            "document_id": req.document_id,
            "chunks_count": len(chunks)
        }
    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, req: DeleteDocumentRequest):
    try:
        deleted = delete_document_chunks(document_id=document_id, user_id=req.user_id)
        return {"status": "deleted", "document_id": document_id, "chunks_deleted": deleted}
    except Exception as e:
        logger.error("Vector deletion failed: %s", e)
        raise HTTPException(status_code=500, detail="Unable to remove document vectors") from e

@router.get("/documents/{document_id}/chunks")
async def list_document_chunks(document_id: str, user_id: str):
    try:
        return {
            "chunks": get_document_chunks(document_id=document_id, user_id=user_id),
        }
    except Exception as e:
        logger.error("Chunk inspection failed: %s", e)
        raise HTTPException(status_code=500, detail="Unable to load document chunks") from e

@router.post("/query")
async def query_pipeline(req: QueryRequest):
    try:
        user_settings = req.settings or {}
        gemini_key = user_settings.get("gemini_api_key") or settings.GEMINI_API_KEY
        tavily_key = user_settings.get("tavily_api_key") or settings.TAVILY_API_KEY
        preferred_model = user_settings.get("preferred_model") or settings.GEMINI_MODEL
        threshold = float(user_settings.get("consensus_threshold", 80.0))
        top_k = int(user_settings.get("similarity_top_k", 5))

        # 1. Compute query embedding
        q_embeddings = compute_embeddings([req.query])
        q_emb = q_embeddings[0]

        # 2. Vector search retrieved chunks
        retrieved_chunks = query_vector_store(
            query_embedding=q_emb,
            top_k=top_k,
            document_ids=req.document_ids,
            user_id=req.user_id,
        )

        if not retrieved_chunks:
            return {
                "synthesis": "I could not find supporting evidence in the selected documents, so I cannot answer this question reliably.",
                "confidence_score": 0,
                "consensus": {
                    "status": "failed",
                    "consensus_score": 0,
                    "agreement_ratio": 0,
                    "conflicts": [],
                    "synthesis": "No evidence was retrieved.",
                    "evaluation_matrix": {
                        "faithfulness": 0,
                        "context_precision": 0,
                        "answer_relevance": 0,
                        "consensus_alignment": 0,
                        "hallucination_risk": "high",
                        "composite_confidence": 0,
                    },
                },
                "evaluation_matrix": {
                    "faithfulness": 0,
                    "context_precision": 0,
                    "answer_relevance": 0,
                    "consensus_alignment": 0,
                    "hallucination_risk": "high",
                    "composite_confidence": 0,
                },
                "agent_executions": [],
                "evidence_sources": [],
            }

        retrieval_quality = sum(float(chunk.get("similarity_score", 0)) for chunk in retrieved_chunks) / len(retrieved_chunks)
        external_verification_enabled = bool(
            settings.EXTERNAL_VERIFICATION_ENABLED
            and tavily_key
            and retrieval_quality < 0.75
        )

        # 3. Agent 1: Researcher
        researcher_res = await run_researcher(
            query=req.query,
            context_chunks=retrieved_chunks,
            model=preferred_model,
            api_key=gemini_key
        )

        # Fact-checking and grounded reasoning use the same retrieved context
        # and can run concurrently; this keeps the query within gateway timeouts.
        fact_checker_res, reasoner_res = await asyncio.gather(
            run_fact_checker(
                query=req.query,
                researcher_output=researcher_res,
                model=preferred_model,
                api_key=gemini_key,
                tavily_key=tavily_key if external_verification_enabled else "",
            ),
            run_reasoner(
                query=req.query,
                context_chunks=retrieved_chunks,
                model=preferred_model,
                api_key=gemini_key,
            ),
        )

        # 5. Agent 3: Critic
        critic_res = await run_critic(
            query=req.query,
            researcher_output=researcher_res,
            fact_checker_output=fact_checker_res,
            model=preferred_model,
            api_key=gemini_key
        )

        trust_res = assess_trust(retrieved_chunks)
        # 6. Consensus engine calculation with evaluation matrix
        consensus = compute_multi_agent_consensus(
            researcher=researcher_res,
            fact_checker=fact_checker_res,
            critic=critic_res,
            trust_assessor=trust_res,
            reasoner=reasoner_res,
            retrieved_chunks=retrieved_chunks,
            threshold=threshold
        )

        # Prepare evidence sources
        evidence_sources = researcher_res.get("sources_cited", [])
        eval_matrix = consensus.get("evaluation_matrix", {})

        return {
            "synthesis": consensus.get("synthesis", reasoner_res.get("raw_output", researcher_res.get("raw_output", ""))),
            "confidence_score": consensus.get("consensus_score", 90),
            "consensus": consensus,
            "evaluation_matrix": eval_matrix,
            "agent_executions": [
                researcher_res,
                fact_checker_res,
                critic_res,
                trust_res,
                reasoner_res,
            ],
            "evidence_sources": evidence_sources,
        }
    except Exception as e:
        logger.error(f"Query pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
