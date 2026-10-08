# Retrieval and Citation Quality Specification

## Goal

Keep irrelevant vector candidates out of specific-question answers, retain source PDF page numbers through ingestion, and describe agent activity accurately in the chat UI.

## Required behavior

1. For a specific question, vector results without lexical evidence are excluded unless their semantic score meets the existing high-confidence gate; query-matching evidence remains eligible.
2. PDF extraction preserves page boundaries and chunks carry the original one-based PDF page number in metadata. Non-paginated formats do not receive fabricated page numbers.
3. The chat UI describes citations and recorded agent activity without claiming that agents are independent or that their trace proves correctness.
4. Existing indexed documents are not rewritten or deleted by deployment. They need re-ingestion to gain page metadata.

## Constraints

- Preserve all pre-existing uncommitted backend, AI-service, research, and evaluation changes; commit only the fix and its tests.
- Do not print, commit, or modify provider secrets.
- Do not change tenant/document scoping or provider fallback behavior.
- Do not claim that vector similarity is factual confidence or calibrated correctness.
- Keep user data and production records untouched during implementation.

## Out of scope

- Tuning thresholds against one example or claiming a measured retrieval improvement without a labeled evaluation set.
- Re-ingesting or deleting production documents.
- Changing the consensus algorithm or paper metrics.
