from __future__ import annotations

from typing import Any, Dict, List


def select_review_context_chunks(
    researcher_output: Dict[str, Any],
    retrieved_chunks: List[Dict[str, Any]],
    *,
    max_chunks: int = 3,
) -> List[Dict[str, Any]]:
    """Keep verifier context compact while retaining cited and top-ranked evidence."""
    if max_chunks <= 0 or not retrieved_chunks:
        return []

    cited_ids = {
        str(evidence_id)
        for claim in researcher_output.get("claims", [])
        if isinstance(claim, dict)
        for evidence_id in claim.get("evidence_ids", [])
        if evidence_id
    }
    cited_chunks = [
        chunk
        for chunk in retrieved_chunks
        if chunk.get("chunk_id") and str(chunk["chunk_id"]) in cited_ids
    ]
    selected = cited_chunks[:max_chunks]
    selected_ids = {str(chunk["chunk_id"]) for chunk in selected}

    for chunk in retrieved_chunks:
        chunk_id = str(chunk.get("chunk_id", ""))
        if chunk_id and chunk_id not in selected_ids:
            selected.append(chunk)
            selected_ids.add(chunk_id)
        if len(selected) >= max_chunks:
            break

    return selected
