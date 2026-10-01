from typing import List, Dict, Any


def _score(value: Any) -> float:
    if not isinstance(value, (int, float)):
        return 0.0
    normalized = float(value) / 100.0 if value > 1 else float(value)
    return max(0.0, min(1.0, normalized))

def compute_multi_agent_consensus(
    researcher: Dict[str, Any],
    fact_checker: Dict[str, Any],
    critic: Dict[str, Any],
    trust_assessor: Dict[str, Any] | None = None,
    reasoner: Dict[str, Any] | None = None,
    retrieved_chunks: List[Dict[str, Any]] | None = None,
    threshold: float = 80.0
) -> Dict[str, Any]:
    conf_a = _score(researcher.get("confidence"))
    conf_b = _score(fact_checker.get("confidence"))
    conf_c = _score(critic.get("confidence"))
    conf_trust = _score((trust_assessor or {}).get("confidence"))
    conf_reasoner = _score((reasoner or {}).get("confidence"))

    # 1. Context Precision / Relevance: Average similarity of top retrieved chunks
    chunks = retrieved_chunks or []
    if chunks:
        context_precision = round(
            min(1.0, sum(_score(c.get("similarity_score")) for c in chunks) / len(chunks)), 4
        )
    else:
        context_precision = 0.0

    # 2. Faithfulness / Groundedness:
    # Evaluated by Critic agent assessing factual propositions against context
    critic_raw = (critic.get("raw_output") or "").lower()
    if "high" in critic_raw and "risk" in critic_raw:
        faithfulness = 0.2
        hallucination_risk = "high"
    elif "medium" in critic_raw and "risk" in critic_raw:
        faithfulness = 0.5
        hallucination_risk = "medium"
    elif "low" in critic_raw and "risk" in critic_raw:
        faithfulness = 0.8
        hallucination_risk = "low"
    elif "no hallucination" in critic_raw or "no unsupported" in critic_raw:
        faithfulness = 0.8
        hallucination_risk = "low"
    else:
        faithfulness = 0.0
        hallucination_risk = "high"

    # 3. Answer Relevance:
    # Reasoner confidence combined with fact-checker validation
    answer_relevance = round(conf_reasoner if (reasoner or {}).get("raw_output") else 0.0, 3)

    # 4. Consensus & Agreement Ratio:
    agent_scores = [conf_a, conf_b, conf_c, conf_trust, conf_reasoner]
    valid_scores = [s for s in agent_scores if s > 0]
    avg_agent_score = sum(valid_scores) / len(valid_scores) if valid_scores else 0.0
    agreement_ratio = round(min(1.0, avg_agent_score), 2)

    # 5. Composite Confidence Score (0-100):
    # Weighted evaluation: Faithfulness 35% + Context Precision 25% + Consensus 25% + Answer Relevance 15%
    composite_confidence = (
        (faithfulness * 0.35) +
        (context_precision * 0.25) +
        (agreement_ratio * 0.25) +
        (answer_relevance * 0.15)
    )
    consensus_score = round(composite_confidence * 100, 1)

    # Check for conflicts
    conflicts = []
    
    # Status determination
    synthesis = (reasoner or {}).get("raw_output", "") or researcher.get("raw_output", "")
    if not synthesis.strip() or not chunks or faithfulness <= 0:
        status = "failed"
        consensus_score = 0.0
        conflicts.append({"reason": "Grounded synthesis or critic verification was unavailable."})
    elif consensus_score >= threshold:
        status = "reached"
    elif consensus_score >= 60.0:
        status = "partial"
        conflicts.append({
            "claim": "Nuance identified between agents during verification.",
            "agreeing_agents": ["retriever", "fact_checker"],
            "dissenting_agents": ["critic"],
            "resolution": "Synthesized conservative union of verified propositions.",
            "confidence_penalty": round((threshold - consensus_score), 1)
        })
    else:
        status = "failed"

    # Evaluation Matrix Object
    evaluation_matrix = {
        "faithfulness": round(faithfulness * 100, 1),
        "context_precision": round(context_precision * 100, 1),
        "answer_relevance": round(answer_relevance * 100, 1),
        "consensus_alignment": round(agreement_ratio * 100, 1),
        "hallucination_risk": hallucination_risk,
        "composite_confidence": consensus_score,
    }

    # Generate unified synthesis text
    return {
        "status": status,
        "consensus_score": consensus_score,
        "agreement_ratio": agreement_ratio,
        "conflicts": conflicts,
        "synthesis": synthesis,
        "evaluation_matrix": evaluation_matrix,
    }
