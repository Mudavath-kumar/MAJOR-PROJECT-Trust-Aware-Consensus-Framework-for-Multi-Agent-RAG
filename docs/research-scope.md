# TrustRAG Research Scope

## Research question

Does an evidence-gated multi-agent decision layer improve supported-answer
quality and calibrated abstention compared with standard document-grounded RAG
while keeping latency and provider cost measurable and acceptable?

## Hypotheses

- H1: Typed claim verification and citation coverage reduce unsupported claims
  compared with single-pass RAG using the same retriever and generator.
- H2: A calibrated answer/partial/abstain decision reduces selective risk on
  unanswerable and contradictory questions.
- H3: Additional verification improves reliability with a measurable latency
  and token-cost trade-off.

## Implemented system boundary

The browser calls the Express backend. The backend authenticates the user,
enforces document ownership, stores original files in Backblaze B2, persists
metadata in MongoDB, and calls the authenticated FastAPI AI service. The AI
service extracts and chunks documents, computes Gemini embeddings, stores
tenant-scoped vectors in MongoDB Atlas Vector Search, retrieves evidence, runs
verification roles, and returns a grounded decision.

Chunking is currently a 400-word window with an 80-word overlap. Retrieval uses
Atlas vector search with a tenant-scoped keyword-overlap fallback. The fallback
is not BM25. The trust assessor is a deterministic provenance heuristic; it is
not an independent fact-checking model.

## Decision vocabulary

- `answer`: evidence and verification satisfy the calibrated decision rule.
- `partial`: some claims are supported but the result has explicit limitations.
- `abstain`: evidence is absent, contradictory, malformed, or below threshold;
  no unsupported synthesized answer is returned.

## Required evaluation

The research release compares vanilla RAG, citation RAG, multi-agent RAG
without gating, TrustRAG without external verification, full TrustRAG, and
component ablations. It reports correctness, retrieval recall, citation
precision/recall, groundedness, unsupported-claim rate, hallucination rate,
calibration, abstention coverage/risk, latency, and cost.

The reproducible metric name for hallucination risk is
`unsafe_acceptance_rate`: the fraction of unanswerable, conflicting, or
prompt-injection questions that were accepted instead of abstained from. This
is an operational safety proxy, not a claim that every accepted answer is a
hallucination. Claim-level support is reported separately as
`unsupported_claim_rate`.

Every run records the dataset version, configuration, model/provider IDs,
prompt version, retrieval settings, random seed, Git revision, timestamp, and
sample count. Private documents, credentials, and production database URLs are
excluded from research artifacts.

## Limitations

The runtime score is a decision aid until calibrated against labelled answers.
LLM-based verification can share the generator's errors, external search can
introduce a separate evidence source, and results may vary by provider/model.
The paper must report these limitations and include security tests for prompt
injection, citation spoofing, contradictory sources, and tenant leakage.
