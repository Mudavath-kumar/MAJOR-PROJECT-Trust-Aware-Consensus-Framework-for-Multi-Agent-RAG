import os
import logging
import asyncio
import base64
import hmac
import tempfile
import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..rag.chunker import (
    chunk_pdf_pages,
    chunk_text,
    extract_pdf_pages_from_file,
    extract_text_from_file,
)
from ..rag.embeddings import compute_embeddings
from ..rag.query_rewriter import rewrite_search_query
from ..rag.vectorstore import (
    add_document_chunks,
    delete_document_chunks,
    get_document_chunks,
    query_vector_store,
)
from ..agents.researcher import run_researcher
from ..agents.fact_checker import run_fact_checker
from ..agents.critic import run_critic
from ..agents.context import select_review_context_chunks
from ..agents.trust_assessor import assess_trust
from ..consensus.engine import compute_multi_agent_consensus
from ..core.config import settings
from ..core.llm_router import LLMProvidersUnavailable
from ..core.verification_policy import should_trigger_external_verification

logger = logging.getLogger("trustrag.api.rag")
async def require_service_token(x_trustrag_service_token: Optional[str] = Header(default=None)) -> None:
    if not settings.SERVICE_TOKEN or not hmac.compare_digest(
        x_trustrag_service_token or "", settings.SERVICE_TOKEN
    ):
        raise HTTPException(status_code=401, detail="Invalid internal service token")


router = APIRouter(
    prefix="/rag",
    tags=["RAG"],
    dependencies=[Depends(require_service_token)],
)

class QueryRequest(BaseModel):
    query: str
    conversation_id: str
    user_id: str
    document_ids: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None

class IngestRequest(BaseModel):
    document_id: str
    filename: str
    file_path: str  # local path (used when on same host)
    file_content_b64: Optional[str] = None  # base64-encoded bytes (cross-host transfer)
    mime_type: Optional[str] = ""
    user_id: str

class DeleteDocumentRequest(BaseModel):
    user_id: str


async def run_review_agents(
    *,
    query: str,
    researcher_output: Dict[str, Any],
    context_chunks: List[Dict[str, Any]],
    model: str,
    api_key: str,
    tavily_key: str,
):
    """Run independent evidence review and claim verification concurrently."""
    return await asyncio.gather(
        run_fact_checker(
            query=query,
            researcher_output=researcher_output,
            model=model,
            api_key=api_key,
            tavily_key=tavily_key,
            context_chunks=context_chunks,
        ),
        run_critic(
            query=query,
            researcher_output=researcher_output,
            context_chunks=context_chunks,
            model=model,
            api_key=api_key,
        ),
    )

@router.post("/ingest")
async def ingest_document(req: IngestRequest):
    tmp_path = None
    try:
        # Resolve the file to extract from:
        # Priority 1 — base64 content sent by backend (cross-container safe)
        # Priority 2 — file_path (works only when backend & AI service share a filesystem)
        work_path = req.file_path
        if req.file_content_b64:
            try:
                file_bytes = base64.b64decode(req.file_content_b64)
                ext = os.path.splitext(req.filename)[1] or ".bin"
                fd, tmp_path = tempfile.mkstemp(suffix=ext, prefix="trustrag_ingest_")
                with os.fdopen(fd, "wb") as f:
                    f.write(file_bytes)
                work_path = tmp_path
                logger.info("Ingest: using base64 content (%d bytes) for %s", len(file_bytes), req.filename)
            except Exception as decode_err:
                logger.warning("Failed to decode base64 content: %s — falling back to file_path", decode_err)

        doc_metadata = {
            "document_id": req.document_id,
            "document_name": req.filename,
            "user_id": req.user_id,
        }
        is_pdf = (
            os.path.splitext(req.filename)[1].lower() == ".pdf"
            or (req.mime_type or "").lower().split(";")[0].strip() == "application/pdf"
        )
        if is_pdf:
            pdf_pages = await asyncio.to_thread(extract_pdf_pages_from_file, work_path)
            chunks = await asyncio.to_thread(
                chunk_pdf_pages,
                pdf_pages,
                chunk_size=400,
                chunk_overlap=80,
                doc_metadata=doc_metadata,
            )
        else:
            raw_text = await asyncio.to_thread(extract_text_from_file, work_path, req.mime_type or "")
            if not raw_text.strip():
                raise ValueError("Document contains no extractable text")
            chunks = await asyncio.to_thread(
                chunk_text,
                raw_text,
                chunk_size=400,
                chunk_overlap=80,
                doc_metadata=doc_metadata,
            )
        if not chunks:
            raise ValueError("Document contains no extractable text")

        texts = [c["text"] for c in chunks]
        embeddings = await asyncio.to_thread(compute_embeddings, texts)
        ids = [f"{req.document_id}_{c['chunk_id']}" for c in chunks]
        metas = [c["metadata"] for c in chunks]

        await asyncio.to_thread(
            add_document_chunks,
            chunk_ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metas,
        )

        logger.info("Ingest complete: %s -> %d chunks", req.filename, len(chunks))
        return {
            "status": "ready",
            "document_id": req.document_id,
            "chunks_count": len(chunks)
        }
    except Exception as e:
        logger.error("Ingestion failed for %s: %s", req.filename, e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

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
        raw_preferred = user_settings.get("preferred_model") or ""
        # Accept any gemini-3.x model from settings; fall back to configured default
        # for empty, non-gemini, or legacy gemini-2.x values.
        if raw_preferred.startswith("gemini-3.") or raw_preferred.startswith("gemini-3.5") or raw_preferred.startswith("gemini-3.7"):
            preferred_model = raw_preferred
        else:
            preferred_model = settings.GEMINI_MODEL
        threshold = max(0.0, min(100.0, float(user_settings.get("consensus_threshold", 80.0))))
        top_k = max(1, min(20, int(user_settings.get("similarity_top_k", 5))))

        # 1. Prefer semantic retrieval; if the embedding provider is unavailable,
        # use the vector store's tenant-scoped lexical fallback over stored text.
        try:
            q_embeddings = await asyncio.to_thread(compute_embeddings, [req.query])
            q_emb = q_embeddings[0]
        except RuntimeError as exc:
            logger.warning(
                "Query embedding unavailable; using scoped lexical retrieval (%s)",
                type(exc).__name__,
            )
            q_emb = []

        # 2. Vector search retrieved chunks
        retrieved_chunks = await asyncio.to_thread(
            query_vector_store,
            query_embedding=q_emb,
            top_k=top_k,
            document_ids=req.document_ids,
            user_id=req.user_id,
            query_text=req.query,
        )

        if not retrieved_chunks:
            return {
                "synthesis": "I could not find supporting evidence in the selected documents, so I cannot answer this question reliably.",
                "confidence_score": 0,
                "consensus": {
                    "status": "failed",
                    "decision_status": "abstain",
                    "decision_score": 0,
                    "abstention_reason": "No supporting evidence was retrieved.",
                    "score_components": {
                        "retrieval_quality": 0,
                        "claim_support": 0,
                        "citation_coverage": 0,
                        "critic_safety": 0,
                    },
                    "consensus_score": 0,
                    "agreement_ratio": 0,
                    "conflicts": [],
                    "synthesis": "No evidence was retrieved.",
                    "evaluation_matrix": {
                        "faithfulness": 0,
                        "context_precision": 0,
                        "answer_relevance": None,
                        "consensus_alignment": 0,
                        "hallucination_risk": "high",
                        "composite_confidence": 0,
                    },
                },
                "evaluation_matrix": {
                    "faithfulness": 0,
                    "context_precision": 0,
                    "answer_relevance": None,
                    "consensus_alignment": 0,
                    "hallucination_risk": "high",
                    "composite_confidence": 0,
                },
                "decision_status": "abstain",
                "decision_score": 0,
                "abstention_reason": "No supporting evidence was retrieved.",
                "agent_executions": [],
                "evidence_sources": [],
            }

        retrieval_quality = sum(float(chunk.get("similarity_score", 0)) for chunk in retrieved_chunks) / len(retrieved_chunks)
        external_verification_enabled = should_trigger_external_verification(
            enabled=settings.EXTERNAL_VERIFICATION_ENABLED,
            api_key_available=bool(tavily_key),
            retrieval_quality=retrieval_quality,
        )

        researcher_res = await run_researcher(
            query=req.query,
            context_chunks=retrieved_chunks,
            model=preferred_model,
            api_key=gemini_key
        )
        review_chunks = select_review_context_chunks(
            researcher_res,
            retrieved_chunks,
            max_chunks=3,
        )
        # Independent reviewers share cited, top-ranked passages without
        # repeatedly sending the full retrieval context to the same provider.
        fact_checker_res, critic_res = await run_review_agents(
            query=req.query,
            researcher_output=researcher_res,
            context_chunks=review_chunks,
            model=preferred_model,
            api_key=gemini_key,
            tavily_key=tavily_key if external_verification_enabled else "",
        )

        trust_res = assess_trust(retrieved_chunks)
        # 6. Consensus engine calculation with evaluation matrix
        consensus = compute_multi_agent_consensus(
            researcher=researcher_res,
            fact_checker=fact_checker_res,
            critic=critic_res,
            trust_assessor=trust_res,
            retrieved_chunks=retrieved_chunks,
            threshold=threshold
        )

        # One bounded external verification/re-consensus pass. External web
        # material is never promoted to user-document evidence.
        if (
            settings.EXTERNAL_VERIFICATION_ENABLED
            and tavily_key
            and consensus.get("status") != "reached"
        ):
            if not external_verification_enabled:
                fact_checker_res = await run_fact_checker(
                    query=req.query,
                    researcher_output=researcher_res,
                    model=preferred_model,
                    api_key=gemini_key,
                    tavily_key=tavily_key,
                    context_chunks=review_chunks,
                )
            consensus = compute_multi_agent_consensus(
                researcher=researcher_res,
                fact_checker=fact_checker_res,
                critic=critic_res,
                trust_assessor=trust_res,
                retrieved_chunks=retrieved_chunks,
                threshold=threshold,
            )

        # Prepare evidence sources
        verified_evidence_ids = set(consensus.get("verified_evidence_ids", []))
        evidence_sources = [
            source
            for source in researcher_res.get("sources_cited", [])
            if str(source.get("chunk_id", "")) in verified_evidence_ids
        ]
        if not evidence_sources:
            evidence_sources = researcher_res.get("sources_cited", [])
        if not evidence_sources and retrieved_chunks:
            evidence_sources = [
                {
                    "document_id": c.get("metadata", {}).get("document_id", ""),
                    "document_name": c.get("metadata", {}).get("document_name", "Document"),
                    "chunk_id": c.get("chunk_id", ""),
                    "text": c.get("text", "")[:300],
                    "similarity_score": c.get("similarity_score", 0.0),
                    "page_number": c.get("metadata", {}).get("page"),
                }
                for c in retrieved_chunks[:5]
            ]
        eval_matrix = consensus.get("evaluation_matrix", {})

        return {
            "synthesis": consensus.get("synthesis", ""),
            "confidence_score": consensus.get("consensus_score", 0),
            "decision_status": consensus.get("decision_status", "abstain"),
            "decision_score": consensus.get("decision_score", 0),
            "abstention_reason": consensus.get("abstention_reason"),
            "consensus": consensus,
            "evaluation_matrix": eval_matrix,
            "agent_executions": [
                researcher_res,
                fact_checker_res,
                critic_res,
                trust_res,
            ],
            "evidence_sources": evidence_sources,
            "external_sources": [
                source for source in fact_checker_res.get("sources_cited", [])
                if source.get("source_type") == "tavily"
            ],
        }
    except LLMProvidersUnavailable as e:
        logger.warning("Query pipeline has no available LLM provider: %s", e)
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Query pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
