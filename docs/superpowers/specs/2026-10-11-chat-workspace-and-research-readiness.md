# Chat Workspace and Research Readiness Design

## Goal

Make the existing TrustRAG chat feel like a focused modern assistant workspace while keeping every displayed answer, citation, status, progress indicator, and score faithful to backend evidence; preserve a separate reproducible path for research-paper evaluation.

## Scope and phases

### Phase 1: Chat experience and interaction correctness

- Retain the existing authenticated backend, conversation persistence, document scoping, upload, retrieval, consensus, citation, and evidence APIs.
- Rework the chat layout into a focused conversation area with collapsible history, a readable message column, a persistent composer, and compact source-scope controls. Keep the existing product theme and responsive behavior.
- Put retrieved evidence, agent execution records, and operational diagnostics behind an explicit, accessible inspection surface rather than making them compete with the answer.
- Preserve Markdown and citation navigation. Make source scope explicit in the prompt area and prevent accidental submission while an answer is pending.
- Replace timer-driven claims of live agent progress with honest request states unless the API supplies corresponding events. Display completed activity only from actual response records.
- Render provider/backend failures as actionable errors, abstentions as abstentions, and partial results as partial. Never fabricate citations, numeric page values, answer confidence, or agent events.
- Add focused regression tests for request scoping, loading/error/answer/abstention rendering, citation interaction, and keyboard/mobile composer behavior where the existing test setup supports them.

### Phase 2: Paper evaluation workflow (separate deliverable)

- Keep the existing isolated experiment harness and five RAG-variant contracts; do not run research experiments against production user documents or production databases.
- Treat the current 200-row project draft as unreviewed authoring material, not a validated dataset. Do not fill paper tables with fabricated values or runtime dashboard scores.
- A paper run remains gated on completed dataset labels/reviews and successful runs for every declared baseline/variant under comparable settings.
- Generate paper tables from run artifacts only, including sample counts and uncertainty intervals; distinguish human-annotated correctness/hallucination measures from system heuristics and retrieval overlap.

## Existing interfaces and constraints

- Frontend: `src/routes/app.chat.tsx`, existing AI-elements conversation/prompt primitives, `src/lib/api-client.ts`, and current document store.
- Backend/AI API contracts remain unchanged in phase 1 unless inspection proves a bug requires a compatible additive contract. No weakening of Clerk auth, service auth, tenant ownership, selected-document scope, or abstention gates.
- Existing user changes elsewhere in the dirty worktree are out of scope and must remain untouched. New commits, if requested, must contain only reviewed task files.
- Do not re-upload, delete, or re-index production documents during implementation. Do not inspect, print, or alter credentials.
- No claim of production end-to-end success based solely on local build/tests. Deployment and live external-provider verification are reported separately.

## Acceptance criteria

1. A user can start/select a conversation, enter a free-form query, submit with keyboard or button, and see exactly the authenticated backend response for the current selected document IDs.
2. Pending state is truthful and stable; errors stop loading and are actionable; a new query cannot render stale answer/evidence data as its result.
3. Answer, partial, and abstain states remain visually distinct. Citations point only to evidence returned by the backend and selecting a citation reveals the matching passage.
4. History, scope controls, conversation, evidence inspection, and composer remain usable at narrow and wide viewports and with keyboard navigation.
5. Paper evaluation surfaces or docs do not present draft labels, smoke-run outputs, operational heuristics, or unexecuted configuration contracts as measured findings.
6. Relevant tests and production builds pass; any blocked or unavailable live integration check is explicitly reported rather than implied successful.

## Risks and mitigations

- The chat route is large and already has user-modified adjacent work: make minimal, targeted edits and inspect the exact diff before testing.
- Existing API records may lack fields: keep presentation tolerant of absent optional metadata without inventing values.
- A redesigned layout can hide useful evidence: retain a clear, accessible inspector and citation-driven navigation.
- A clean local result cannot prove Render/Vercel deployment or Gemini quota: state local and live verification independently.

## Review checklist

- No new backend behavior is introduced solely to support decorative progress animation.
- No paper metric is sourced from the UI heuristic scores.
- No user's unrelated changes are overwritten, staged, or reverted.
- All phase-1 requirements have a test or a documented reason they require live/manual verification.
