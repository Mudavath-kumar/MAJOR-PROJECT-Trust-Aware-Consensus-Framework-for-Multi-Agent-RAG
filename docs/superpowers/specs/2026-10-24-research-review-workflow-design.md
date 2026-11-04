# Research Benchmark Review Workflow Design

## Problem

The current `/app/evaluations` route displays audit signals for production chat
messages. It does not review the public HotpotQA benchmark candidate. The
candidate and its source corpus are checked into the repository, and its review
fields are pending. The existing paper runner requires two human approvals,
but the project owner has only one human reviewer available. The application
needs an honest, persistent review path that does not impersonate a second
person or silently approve records.

## Goal

Add a dedicated authenticated Research Review workflow for the frozen
`trustrag-public-candidate-v4` dataset. It lets the signed-in reviewer inspect
each question against its source labels and scoped corpus, record an explicit
decision and notes, resume progress across sessions, and export a reviewed
dataset only after all 200 records pass the automated integrity checks and
receive an explicit human approval.

The evaluation protocol is recorded as **one human reviewer plus automated
consistency checks**. It must never be represented as two independent human
reviewers or as a model-generated semantic ground-truth annotation.

## Non-goals

- Do not change the production AI chat, upload, or retrieval behavior.
- Do not call Gemini, OpenRouter, Tavily, or any paid provider during review.
- Do not let the UI edit source questions, gold answers, or evidence IDs in
  place. Corrections are recorded as notes and require a corrected candidate
  version before approval.
- Do not expose the existing production chat-audit scores as benchmark labels.
- Do not remove the existing two-human approval option for datasets that use
  that protocol.

## User flow

1. A signed-in user opens a separate **Research Review** navigation item.
2. The page shows the 200-record candidate, review progress, filters by answer
   type and decision state, and search by question or record ID.
3. Opening a record shows its question, candidate answer/expected behavior,
   original HotpotQA answer and supporting facts, each scoped corpus document,
   and synthetic conflict/injection documents clearly marked as synthetic.
4. The reviewer chooses **Approved** only when the record follows the
   category-specific checklist. **Needs correction** requires a note. A saved
   decision is attributable to the authenticated account and can be revisited
   or changed; the immutable source candidate is never edited by the UI.
5. Progress and decisions are stored in MongoDB per user, dataset version, and
   record ID. One user's work does not overwrite another user's work.
6. An export action is enabled only when that user's 200 decisions are all
   approved and the server-side automated integrity audit passes. Export
   produces a reviewed JSONL copy with an explicit single-human-plus-automated
   review protocol and audit version/hash. The original candidate remains
   unchanged.
7. The paper matrix runner accepts the new protocol only when its required
   fields and audit metadata are complete. Existing two-human-reviewed datasets
   retain their current behavior. Run manifests and paper tables must not claim
   two-human validation for the new protocol.

## Automated checks

The backend loads only the fixed v4 dataset, source snapshot, corpus manifest,
and corpus files shipped with the repository. Before serving or exporting a
record it verifies:

- exact 200-record 100/50/25/25 composition and unique candidate/source IDs;
- source question/answer linkage and CC BY-SA provenance;
- document snapshot hashes, evidence IDs, and per-record document scope;
- annotated support facts present in cited trusted evidence for answerable and
  injection cases;
- annotated support facts absent from the scoped corpus for unanswerable cases;
- conflict fixtures directly contradict the trusted source answer and remain
  explicitly synthetic;
- synthetic conflict chunks are not labeled as gold evidence;
- injection fixtures are synthetic and are not used as gold evidence;
- no record has been marked approved by the automated audit itself.

These checks prove data/provenance consistency, not semantic correctness or
human agreement. The UI must describe this limitation near the review/export
controls. The human reviewer remains responsible for semantic judgments.

## API and persistence

All research-review endpoints are mounted under `/api/v1/research/benchmark`
and require the existing `authenticate` middleware. The browser cannot provide
an arbitrary filesystem path or reviewer identity.

- `GET /` returns a paginated/filterable record list and the current user's
  review decisions and progress summary.
- `GET /:recordId` returns the source example, supporting-fact text, scoped
  corpus documents, and explicitly labeled synthetic challenge documents for
  one allowlisted record.
- `PUT /:recordId/review` accepts only `approved` or `needs_correction` plus a
  bounded notes string; correction notes are required. User ID and email come
  from the verified session, not the request body.
- `GET /export` returns a JSONL attachment only after every record is approved
  by this user and all automated checks pass.

MongoDB stores one review per `(user_id, dataset_version, record_id)` with a
unique compound index, decision, notes, and server timestamps. The API fails
closed on database unavailability for writes and export. Reads never reveal
other users' review notes. Public benchmark text is served only from fixed
repository files; paths are resolved and checked against the repository data
root to prevent traversal.

## Frontend

Add `/app/research-review` as a distinct route and sidebar entry. Reuse the
current TrustRAG dark theme, page primitives, `ApiClient`, and authenticated
backend session. The page includes:

- progress counts (unreviewed, approved, needs correction) and a clear
  automated-audit status;
- category and decision filters, searchable record IDs/questions, previous/next
  navigation, and a record list;
- a detail panel separating trusted HotpotQA documents from synthetic challenge
  documents, with evidence IDs and supporting-fact highlights;
- accessible approve/correction controls, notes validation, save/error/loading
  states, and a confirmation before changing an existing decision;
- a disabled-until-ready JSONL export control with a plain explanation of any
  remaining gate.

The UI never presents unreviewed content as approved and does not use dashboard
confidence or similarity scores as review evidence.

## Data and deployment

The source of truth is the checked-in v4 candidate under
`experiments/datasets/trustrag-public-candidate-v4/`. The earlier v3 candidate
is retained as a superseded snapshot because its conflict rows incorrectly
included synthetic contradiction chunks in `gold_evidence_ids`. The backend uses a fixed
version/path, not a client-supplied path or uploaded file. Render's backend
build must retain this repository data at runtime; research endpoints fail
clearly with 503 if the fixed files are missing or their audit hashes mismatch,
without preventing unrelated backend features from starting. Vercel serves only the frontend; MongoDB persists review
decisions. No secrets or private user documents are copied into benchmark
artifacts.

## Error and integrity behavior

- Unauthenticated users receive the existing 401 behavior.
- Unknown record IDs return 404; malformed decisions or oversized notes return
  400; database unavailable returns 503.
- The backend uses optimistic timestamps/version checks to avoid silently
  overwriting a newer decision from another tab for the same account.
- Export refuses if records are missing, rejected, stale against the source
  hashes, or have failed automated checks.
- Export filename includes the dataset version and is generated from a new
  response; it never overwrites repository files.

## Acceptance criteria

1. The signed-in reviewer can open all 200 records and see the exact source,
   trusted evidence, scoped documents, and synthetic challenges.
2. Decisions persist per authenticated user and survive refresh/relogin.
3. Other users cannot read or overwrite a reviewer's saved notes.
4. Invalid decisions, correction-without-notes, stale writes, and unavailable
   database paths fail safely.
5. The export remains disabled/returns a clear gate error until all 200 human
   decisions are approved and the automated consistency audit passes.
6. Export records one human plus automated checks truthfully; it never fills in
   a fake second reviewer.
7. The paper runner accepts a valid export and continues to reject pending,
   failed-audit, wrong-version, or tampered datasets before provider calls.
8. Existing `/app/evaluations` chat audit remains unchanged.
9. Frontend and backend tests cover the review flow, access boundaries, and
   paper-runner gate; builds pass.
