# TrustRAG Chat Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve only the existing TrustRAG AI Chat route so free-form questions, responses, source scope, citations, errors, and pending states are reliable and easy to use.

**Architecture:** Keep the existing authenticated API and document-store contracts. Make focused changes in the chat route and its existing presentation helper; show backend-backed states honestly, remove simulated agent-stage completion/typewriter output, and retain the current theme and evidence data. Verify helper behavior with Node's built-in test runner, then inspect the local rendered chat and run lint/build.

**Tech Stack:** React 19, TypeScript, TanStack Start, existing AI Elements and Tailwind theme tokens, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-11-chat-workspace-and-research-readiness.md` (Phase 1 only)

## Global Constraints

- Edit only `src/routes/app.chat.tsx`, `src/lib/chat-presentation.ts`, and focused chat tests; this task does not include backend, AI service, evaluation, paper workflow, shared theme, or other pages.
- Preserve Clerk authentication, conversation APIs, document ownership/scope, upload and ingestion APIs, response schema, citations, abstention behavior, and current TrustRAG theme.
- Do not render fake agent events, fabricated confidence/page data, fallback answers, or stale evidence as the current answer.
- Do not inspect, print, or change credentials; do not mutate production documents or deployments.
- Preserve every unrelated existing working-tree change; stage or commit nothing as part of this task.

---

### Task 1: Lock reliable chat presentation behavior

**Files:**

- Modify: `src/lib/chat-presentation.ts`
- Test: `test/chat-presentation.test.ts`

**Interfaces:**

- Preserve existing `mapAgentExecutions`, `mapChatScores`, and `formatSourcePage` exports.
- Add only a small pure helper if needed to represent the UI request state (`idle`, `pending`, `answer`, `partial`, `abstain`, or `error`) without creating scores or execution events.

- [x] **Step 1: Add tests first** for pending/error precedence, distinct answer/partial/abstention states, and empty/unknown backend metadata. Assert that missing measurements remain `null`, not zero.
- [x] **Step 2: Run the focused test** with `node --experimental-strip-types --test test/chat-presentation.test.ts` and confirm the new assertions fail for the missing behavior.
- [x] **Step 3: Implement the smallest pure presentation helper** in `src/lib/chat-presentation.ts`; do not alter API payloads or synthesize agent records.
- [x] **Step 4: Re-run the focused test** and confirm all old and new assertions pass.

### Task 2: Make chat requests, loading, errors, and evidence truthful

**Files:**

- Modify: `src/routes/app.chat.tsx`
- Test: `test/chat-presentation.test.ts` (only if a new pure status helper is used)

**Interfaces:**

- Keep `ApiClient.createConversation`, `ApiClient.sendMessage`, `ApiClient.getMessages`, `ApiClient.deleteConversation`, and `ingestFile` contracts unchanged.
- Keep selected document IDs attached to each request exactly as the current scope UI specifies; an empty selection continues to mean all indexed documents.

- [x] **Step 1: Remove the timer-driven `AGENT_STEPS` timeline and the character-by-character response timer.** While API calls are pending, show one stable, accessible “Searching selected sources and verifying evidence…” state. On response, render the exact backend answer immediately; show agent records only from `assistant_message.agent_executions`.
- [x] **Step 2: Prevent stale turn/evidence display.** Clear or isolate current-response evidence when a new query starts, when switching conversations, and when starting a new chat; ignore late conversation-load results if the user switched threads again before the response arrived.
- [x] **Step 3: Keep request lifecycle complete.** Block duplicate submits while pending; retain arbitrary trimmed user prompts; surface upload errors in the chat UI and allow retry; make conversation-load failures visible without replacing the selected conversation with old messages.
- [x] **Step 4: Run focused helper tests and ESLint on the changed route/helper.** Confirm no response formatting, status, citations, or source scoping regressions.

### Task 3: Refine only the Chat workspace and verify interactions

**Files:**

- Modify: `src/routes/app.chat.tsx`

**Interfaces:**

- Retain current `Panel`, `Button`, `PromptInput`, `Conversation`, answer Markdown, citation navigation, score labels, and existing CSS/theme tokens.
- Do not modify shared components or global styles.

- [x] **Step 1: Keep the existing sidebar/main/evidence structure but make the conversation the visual focus:** readable centered answer width, compact source-scope summary, responsive/collapsible history, and an evidence inspector that remains available without crowding the message.
- [x] **Step 2: Make keyboard/touch actions semantic and visible:** conversation rows are keyboard-operable controls, delete remains a separate accessible action, source scope buttons declare their pressed state, composer has a clear accessible label, and buttons have explicit types.
- [ ] **Step 3: Inspect the local rendered route** at desktop and narrow viewport widths. Exercise free-form custom prompt, Enter/Shift+Enter, pending duplicate prevention, answer/partial/abstain/error presentation, citation-to-evidence selection, history switching, source selection, and upload error feedback where local configuration permits. **Blocked:** the local dev server started, but the desktop browser sandbox could not connect to the workspace loopback port; rendered visual/interactivity QA remains unverified.
- [x] **Step 4: Run the existing frontend Node tests, targeted ESLint, `tsc --noEmit`, and `npm run build`.** Review `git diff --check` and confirm only task-scoped files were changed by this task. The TypeScript and MJS test suites, targeted ESLint, type check, and production build passed. Repository-wide `npm run lint` was attempted but traversal was blocked by denied `.pytest_cache` access; do not report it as passing.

## Acceptance Review

- A custom question is submitted with the exact selected document scope and displays only the backend's response.
- Pending UI does not claim agents ran or imply a fake duration/progress; returned agent activity is sourced from response records.
- Errors end pending state and are visible/actionable; upload and thread-loading failures do not disappear into console-only logs.
- A new request or thread never shows stale citations/evidence as current results.
- Existing answer, partial, abstention, citation, and operational-score distinctions remain intact.
- Only the Chat route/helper and chat-focused test files are changed; existing unrelated dirty files remain untouched.
- Local checks are reported separately from Render/Vercel, Clerk, Gemini, or other live service verification.
