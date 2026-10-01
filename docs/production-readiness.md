# TrustRAG production readiness

This document records the checks that must be true before calling the deployed
system production-ready.

## Verified in the source workspace

- Backend security tests: 9 passing.
- Backend TypeScript compilation: passing.
- Frontend tests: 7 passing.
- Frontend TypeScript compilation: passing.
- Frontend production build: passing.
- Deployment contract tests: 3 passing.
- `git diff --check`: passing.
- The build output is free of demo documents, fake scores, local ingestion
  fallbacks, and embedded backend AI paths.

The frontend lint command currently reports warnings from generated/shared UI
components and broad `any` response types. These warnings do not block the
build, but they should be reduced in a separate UI typing cleanup rather than
mixed into deployment repair.

The Python interpreter is not installed on the current Windows host, so the
FastAPI test and compile commands must run in the AI service container or a
Python 3.11 environment before release.

## Deployment contract

Vercel must build from the repository root with pnpm and set:

```text
VITE_API_URL=https://trustrag-backend-j3oe.onrender.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=<frontend publishable key>
```

Render must run these two services from the same repository revision:

```text
trustrag-backend-j3oe  -> backend/ -> npm install --include=dev && npm run build
trustrag-ai-service   -> Dockerfile.ai-service -> FastAPI on port 8000
```

Both services must receive the same `AI_SERVICE_TOKEN`.

## Required secret names

Do not put values in this file or in chat. Set the values in Render/Vercel
secret managers:

```text
MONGODB_URI
GEMINI_API_KEY
OPENROUTER_API_KEY
TAVILY_API_KEY
AI_SERVICE_TOKEN
SETTINGS_ENCRYPTION_KEY
B2_ENDPOINT
B2_REGION
B2_KEY_ID
B2_APPLICATION_KEY
B2_BUCKET_NAME
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
FRONTEND_URL
CORS_ALLOWED_ORIGINS
VITE_API_URL
VITE_CLERK_PUBLISHABLE_KEY
```

`GEMINI_API_KEY` is required for document embeddings. OpenRouter is the LLM
fallback. Tavily is optional only when external verification is disabled.

## Live verification gate

After both Render services and Vercel deploy the same revision:

1. `GET https://trustrag-ai-service.onrender.com/health` reports `ready: true`.
2. `GET https://trustrag-backend-j3oe.onrender.com/api/v1/health` reports
   `ready: true`, with connected MongoDB and healthy AI service.
3. Unauthenticated `GET /api/v1/auth/me`, `/documents`, and `/settings`
   return `401`, never a demo user or settings record.
4. A logged-in user uploads a non-sensitive TXT test document.
5. The document reaches `ready` with a positive chunk count and exists in B2.
6. A question scoped to that document returns evidence from that document.
7. A second user cannot retrieve the first user's document, chunks, or answer.
8. Deleting the document removes its B2 object, MongoDB metadata, and vectors.

The live deployment previously failed this gate because Vercel and Render were
serving the old revision. A 200 health response alone is not proof of the
upload-to-answer path.
