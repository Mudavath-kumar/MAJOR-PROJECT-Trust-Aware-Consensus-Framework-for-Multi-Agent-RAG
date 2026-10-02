# TrustRAG Runtime and Research Architecture

This document describes the implemented runtime. The research plan is in
`docs/research-scope.md`; historical design alternatives are not presented as
implemented components.

## Runtime flow

```text
Browser
  -> Express backend (auth, ownership, persistence, Backblaze)
  -> FastAPI AI service (extraction, chunking, embeddings, retrieval, agents)
  -> MongoDB Atlas (metadata, conversations, vector chunks)
  -> Gemini embeddings + configured LLM provider
```

The backend is the only browser-facing API. The AI service requires the
internal service token and receives tenant and document scope on every
operation.

## Document pipeline

1. The authenticated backend validates the upload and stores the original in
   Backblaze B2.
2. The backend sends document bytes to the AI service.
3. The AI service extracts text from PDF, DOCX, TXT, Markdown, CSV, or JSON.
4. Text is split using a 400-word window with an 80-word overlap.
5. Gemini embeddings are stored in MongoDB Atlas Vector Search.
6. The backend marks the document ready only after indexing succeeds.

## Retrieval and answer pipeline

1. Query embeddings are searched in Atlas with `user_id` and optional
   `document_id` filters.
2. If Atlas Vector Search is unavailable, a tenant-scoped keyword-overlap
   fallback is used. This is not BM25 and must not be described as BM25.
3. The researcher, fact-checker, critic, and reasoner use the retrieved
   evidence. The trust assessor is a deterministic provenance heuristic based
   on retrieval signals, not an independent LLM agent.
4. The consensus layer combines typed evidence checks, retrieval provenance,
   citation coverage, and critic safety into a decision score.
5. The final status is `answer`, `partial`, or `abstain`. Missing or
   contradictory evidence must fail closed.

## Research implementation boundaries

- Retrieval similarity is a retrieval signal, not factual truth.
- LLM confidence is not treated as calibrated correctness until evaluated
  against labelled examples.
- External Tavily results remain separate from selected-document evidence.
- Production data and private documents are not copied into experiment output.
- Baselines and ablations live under `experiments/` and record their complete
  configuration and Git revision.

## Security boundaries

- Browser authentication is verified by the backend.
- Document ownership is checked before upload, deletion, chunk inspection, and
  chat retrieval.
- AI-service requests require the internal service token.
- Vector queries always require a user ID and apply tenant scope.
- Provider credentials remain server-side and are never sent to the browser.
