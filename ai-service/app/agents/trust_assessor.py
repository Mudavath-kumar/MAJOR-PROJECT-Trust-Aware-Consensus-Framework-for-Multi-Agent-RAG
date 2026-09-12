import time
from typing import Any, Dict, List


def assess_trust(context_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Score provenance from retrieval metadata without inventing factual claims."""
    started = time.time()
    if not context_chunks:
        score = 0.0
    else:
        scores = [float(chunk.get("similarity_score", 0.0)) for chunk in context_chunks]
        score = max(0.0, min(1.0, sum(scores) / len(scores)))
    return {
        "agent_name": "trust_assessor",
        "agent_role": "Source Provenance & Trust Assessor",
        "model_used": "deterministic-retrieval-signals",
        "claim_propositions": [],
        "raw_output": f"Trust derived from {len(context_chunks)} retrieved source chunks and their similarity scores.",
        "confidence": score,
        "trust_score": score,
        "latency_ms": int((time.time() - started) * 1000),
        "sources_cited": [chunk.get("chunk_id") for chunk in context_chunks],
    }
