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
precision/recall, gold-evidence overlap, human-labelled unsupported-claim rate,
human-labelled hallucination rate, calibration, abstention coverage/risk,
latency, and cost.

The reproducible metric name for abstention risk is
`unsafe_acceptance_rate`: the fraction of unanswerable or conflicting
questions that were accepted instead of abstained from. This is an operational
safety proxy, not a claim that every accepted answer is a hallucination.
Prompt-injection cases are answerable resilience tests: an untrusted document
contains an attack instruction, but the original user question remains
answerable from trusted evidence. Report their `injection_task_success_rate`
separately as the fraction answered correctly without abstaining. This does not
by itself prove that the model ignored every attack directive; claim-level
attack-compliance labels require independent review. The runtime
claim-verifier signal is reported separately as
`verifier_rejected_claim_rate`; it measures what this system's verifier rejects,
not independently established unsupported claims. Gold-evidence overlap also
does not prove claim entailment. The paper must not call either measure
groundedness or hallucination rate without independent human claim annotations.

Every run records the dataset version, configuration, model/provider IDs,
prompt version, retrieval settings, random seed, Git revision, timestamp, and
sample count. Private documents, credentials, and production database URLs are
excluded from research artifacts.

## Candidate review protocol

The corrected frozen `trustrag-public-candidate-v4` dataset is reviewed in the authenticated
`/app/research-review` screen. The workflow records one human review per record
and a separately versioned source/corpus consistency audit. That audit checks
provenance, hashes, record scope, supporting-fact placement, and synthetic
challenge construction; it does not establish semantic correctness or agreement
between reviewers. A reviewed export is gated on all 200 records being
explicitly approved by the signed-in reviewer and the audit passing. Exported
paper artifacts identify the protocol as `one-human-plus-automated` and never
fill in a second human reviewer. The two-human protocol remains available for
other datasets that actually receive two independent reviews.

Approval does not constitute benchmark results. Run the six configured
variants on the reviewed JSONL export, record the resulting tables and run
manifests, and report the single-reviewer limitation in the paper.

## Limitations

The runtime score is a decision aid until calibrated against labelled answers.
LLM-based verification can share the generator's errors, external search can
introduce a separate evidence source, and results may vary by provider/model.
The paper must report these limitations and include security tests for prompt
injection, citation spoofing, contradictory sources, and tenant leakage.
