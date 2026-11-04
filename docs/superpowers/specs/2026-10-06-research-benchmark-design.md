# TrustRAG Research Benchmark Design

## Goal

Create a reproducible, research-only evaluation workflow that builds a
versioned corpus from committed project documents, executes five explicitly
defined RAG variants, scores labelled predictions, and renders paper-ready
tables without treating draft labels or production dashboard scores as
evidence.

## Scope

The workflow covers:

- corpus snapshotting and deterministic chunk identifiers;
- dataset authoring and validation for answerable, unanswerable, conflicting,
  and prompt-injection questions;
- execution of StandardRAG, RerankedRAG, RAG+Verification,
  FixedMulti-AgentRAG, and Trust-AwareConsensusRAG;
- per-query telemetry for latency, LLM calls, verification calls, and
  retrieval calls;
- aggregate metrics, paired bootstrap intervals, and CSV/LaTeX tables.

It does not modify the browser UI, production authentication, production
MongoDB collections, or deployed service configuration. Research runs use a
separate local or explicitly configured research data path and never write
credentials or private source text into committed artifacts.

## Initial corpus

The initial corpus is built from committed project-owned text files:

- `PRD.txt`;
- `README.md`;
- `BACKEND_AI_GUIDE.md`;
- `APPROACHES.md`;
- `docs/research-scope.md`;
- `docs/production-readiness.md`;
- `docs/test-sample.txt`.

The corpus builder records each source path, byte SHA-256, word count, and
dataset version. Source text remains local; only the manifest and derived
chunk IDs are included in research artifacts. Additional PDFs may be added
later through the same manifest path.

## Dataset workflow

The builder emits a review template, not fabricated ground truth. Each record
contains:

```json
{
  "id": "q-0001",
  "dataset_version": "trustrag-v1",
  "question": "...",
  "answer_type": "answerable",
  "gold_answer": "...",
  "gold_evidence_ids": ["doc-1:chunk-3"],
  "documents": [{"document_id": "doc-1", "snapshot_sha256": "..."}],
  "review": {"reviewer_a": "pending", "reviewer_b": "pending", "resolution": "pending"}
}
```

The validator requires non-pending review status before a paper run. It checks
that evidence IDs belong to the source snapshot, that the planned answer-type
composition is present, and that no secret-like values occur. A draft run may
be executed for plumbing tests but is labelled `draft` and cannot render a
paper result table.

## Variant contract

Every variant uses the same corpus, question IDs, chunk size (400 words),
overlap (80 words), generator/embedding identifiers, temperature (0.1), top-K
(5), and seed (42).

1. StandardRAG: retrieve and generate once; no reranking, verification, or
   abstention gate.
2. RerankedRAG: retrieve a candidate set, apply the checked-in hybrid
   lexical-semantic reranker, then generate once; no verification or
   abstention gate.
3. RAG+Verification: retrieve, generate structured claims, verify claims, and
   return the generated answer; no multi-agent consensus or abstention gate.
4. FixedMulti-AgentRAG: run the fixed researcher, fact-checker, critic, and
   reasoner roles; do not apply the TrustRAG trust-aware decision gate.
5. Trust-AwareConsensusRAG: run the current typed verification, trust-aware
   consensus, abstention gate, and conditional external verification policy.

The adapter records which contract was executed in the run manifest. It fails
closed when a requested variant cannot be executed rather than silently
falling back to the full TrustRAG pipeline.

## Prediction and metrics contract

Each executed question produces one prediction record containing the answer,
status, decision score, retrieved/cited evidence IDs, claim support labels,
latency, `llm_calls`, `verification_calls`, `retrieval_calls`, and estimated
cost when available. The existing labelled metrics calculator remains the
single source of aggregate values.

Table II is generated from answer quality, grounding, retrieval, safety,
calibration, and abstention metrics. Table III is generated from latency,
LLM calls/query, verification rate, retrieval calls/query, and cost. Every
cell includes the run sample count and paired bootstrap interval in the report
sidecar; no number is typed into source code.

## Acceptance criteria

- The corpus manifest is deterministic and secret-free.
- Draft dataset records are rejected from paper mode until two reviewer
  decisions and a resolution are present.
- Each of the five variants has a distinct execution test and manifest mode.
- An adapter failure cannot be recorded as a successful prediction.
- The full research test suite passes.
- A smoke run produces metrics and report-sidecar plumbing from a small
  fixture, while the paper table renderer rejects the smoke manifest.
- A paper run refuses an incomplete dataset and writes no paper tables.
