# TrustRAG Audit Remediation Specification

## Goal

Correct the verified answer-safety, document-scope, authentication, and benchmark-measurement defects found in the repository audit without replacing the existing benchmark work or inventing research data.

## Required behavior

1. A verifier may support a claim only when it cites at least one chunk actually retrieved for that query. Unsupported or malformed evidence IDs fail closed.
2. The production answer contains only claim text that passed verification against retrieved evidence. No separate, unverified model synthesis is returned as the answer. The reported consensus-alignment score compares agent judgments, not confidence averages.
3. Chat retrieval is limited to the requesting user's ready documents. An explicitly empty document scope retrieves nothing. Failed ingestion attempts trigger best-effort vector cleanup.
4. Clerk RS256 and ES256 signatures are verified using their correct encodings.
5. Backend upload allowlists match formats supported by the AI extractor.
6. Benchmark latency includes retrieval. LLM call counts and model/provider metadata reflect actual provider attempts when using the service adapter. Paired confidence intervals resample matched records and recompute each metric on each resample.
7. The existing pending dataset remains ineligible for paper mode. No synthetic or unreviewed scores are presented as research results.

## Constraints

- Preserve all pre-existing, uncommitted benchmark changes.
- Do not read, print, commit, or modify provider secrets.
- Keep application provider fallback behavior unchanged; record each attempted provider/model in research telemetry.
- Make code changes only where supported by the audit and add regression tests before implementation.
- Live production login state is not observable without an authenticated browser-control tool; do not infer it from the URL.

## Out of scope

- Authoring or approving the paper dataset: this requires independent human annotations and real evaluation questions.
- Claiming live Vercel/Render end-to-end success without an authenticated browser and production test data.
