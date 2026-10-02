# Research Paper Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current TrustRAG product prototype into a reproducible, evidence-gated RAG research system with validated metrics, baselines, ablations, calibration, security evaluation, and paper-ready documentation.

**Architecture:** Keep the existing frontend, Express backend, FastAPI AI service, MongoDB Atlas Vector Search, Backblaze storage, Gemini embeddings, and OpenRouter/Gemini generation path. Add typed claim/evidence contracts to the AI service, replace text-parsing consensus heuristics with a deterministic decision layer, and add an isolated `experiments/` harness that records configurations and raw results without mixing research data into production collections.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, PyMongo, existing Gemini/OpenRouter clients, TypeScript/Express, TanStack Start, Node test runner, pytest, JSONL experiment datasets, and Python standard-library metric implementations unless an existing dependency already provides the metric.

**Spec:** `PRD.txt` sections 60–65 and the research assessment in the project conversation.

## Global Constraints

- Never print, commit, or copy provider credentials, JWT secrets, uploaded documents, or production database URLs into research artifacts.
- The runtime must distinguish `answer`, `partial`, and `abstain`; an abstention must not contain an unsupported synthesized answer.
- A retrieval similarity score is a retrieval signal, not factual truth or source authority.
- The deterministic trust assessor must be documented as a provenance heuristic unless it is replaced by a validated model.
- Every reported metric must identify its dataset version, model/provider ID, prompt version, retrieval settings, seed, timestamp, and sample count.
- Production API behavior must remain tenant-scoped and fail closed while research instrumentation is added.
- Baselines must use the same corpus, embedding model, generator model, retrieval settings, and evaluation questions whenever the comparison claims to isolate the consensus layer.

---

### Task 1: Freeze the research scope and correct inaccurate claims

**Files:**
- Create: `docs/research-scope.md`
- Modify: `README.md`
- Modify: `BACKEND_AI_GUIDE.md`
- Modify: `APPROACHES.md`
- Modify: `PRD.txt`
- Test: `test/research-documentation.test.mjs`

**Interfaces:**
- Produces one authoritative description of the deployed pipeline, research question, hypotheses, terminology, and known limitations.
- Later tasks use the exact status values and metric names defined in `docs/research-scope.md`.

- [ ] **Step 1: Write the documentation regression test**

Add a Node test that reads the five documentation files and asserts that they contain the canonical terms `MongoDB Atlas Vector Search`, `word-window chunking`, `provenance heuristic`, `answer`, `partial`, and `abstain`. Assert that `APPROACHES.md` no longer claims the runtime uses ChromaDB, BGE embeddings, Ollama, or LangGraph unless those dependencies are present in the runtime.

- [ ] **Step 2: Run the documentation test to verify it fails**

Run:

```powershell
node --test test/research-documentation.test.mjs
```

Expected: FAIL because the current documents contain stale ChromaDB/BGE/LangGraph claims and do not define the runtime decision statuses.

- [ ] **Step 3: Write `docs/research-scope.md`**

Document the research question, three hypotheses, the actual pipeline, the distinction between LLM roles and deterministic retrieval signals, the planned benchmark, the baseline matrix, and the limitations. State that the primary contribution is evidence-gated answer/abstain decision-making, not the frontend or deployment.

- [ ] **Step 4: Correct the existing documentation**

Remove stale implementation alternatives from the active architecture sections. Change “five independent agents” to “four LLM roles plus a deterministic provenance heuristic” unless later experiments prove independent agents. Replace “hybrid BM25” with “Atlas vector search with tenant-scoped keyword fallback” until a real BM25 implementation exists. Replace sentence-boundary claims with the actual word-window behavior.

- [ ] **Step 5: Run the documentation test and commit**

Run the test again, then commit:

```powershell
node --test test/research-documentation.test.mjs
git add docs/research-scope.md README.md BACKEND_AI_GUIDE.md APPROACHES.md PRD.txt test/research-documentation.test.mjs
git commit -m "docs: define reproducible TrustRAG research scope"
```

Expected: PASS.

### Task 2: Add typed claim and evidence contracts

**Files:**
- Create: `ai-service/app/agents/schemas.py`
- Modify: `ai-service/app/agents/researcher.py`
- Modify: `ai-service/app/agents/fact_checker.py`
- Modify: `ai-service/app/agents/critic.py`
- Modify: `ai-service/app/agents/reasoner.py`
- Modify: `ai-service/app/api/rag.py`
- Test: `ai-service/tests/test_agent_schemas.py`

**Interfaces:**
- `Claim`: `claim_id: str`, `text: str`, `evidence_ids: list[str]`.
- `ClaimVerification`: `claim_id: str`, `label: Literal["supported", "contradicted", "insufficient"]`, `evidence_ids: list[str]`, `confidence: float`.
- `CriticResult`: `risk: Literal["low", "medium", "high"]`, `unsupported_claim_ids: list[str]`, `confidence: float`.
- `DecisionResult`: `status: Literal["answer", "partial", "abstain"]`, `decision_score: float`, `abstention_reason: str | None`.

- [ ] **Step 1: Write failing schema tests**

Test that valid structured payloads parse, scores are clamped to `[0, 1]`, unknown claim IDs are rejected by the consensus input validator, and malformed free-form agent text cannot be silently treated as a verified result.

- [ ] **Step 2: Run the schema tests to verify failure**

Run:

```powershell
python -m pytest ai-service/tests/test_agent_schemas.py -q
```

Expected: FAIL because the schemas do not exist.

- [ ] **Step 3: Implement the Pydantic contracts**

Create the models with strict field types, bounded confidence validators, non-empty IDs, and explicit enum values. Preserve the existing API response fields during this task so frontend compatibility is not broken.

- [ ] **Step 4: Update agent prompts and parsing**

Require JSON-only outputs matching the models. Preserve raw model output for audit purposes, but mark parsing failures as `insufficient` rather than extracting bullet points or inferring correctness from text formatting.

- [ ] **Step 5: Run tests and commit**

Run the targeted tests, the existing AI tests, and commit:

```powershell
python -m pytest ai-service/tests/test_agent_schemas.py ai-service/tests/test_config.py ai-service/tests/test_vectorstore_scope.py -q
git add ai-service/app/agents ai-service/app/api/rag.py ai-service/tests/test_agent_schemas.py
git commit -m "feat: add typed evidence and claim contracts"
```

### Task 3: Replace heuristic consensus with evidence-gated decision logic

**Files:**
- Modify: `ai-service/app/consensus/engine.py`
- Create: `ai-service/app/consensus/decision.py`
- Modify: `ai-service/app/api/rag.py`
- Modify: `ai-service/app/agents/trust_assessor.py`
- Test: `ai-service/tests/test_consensus.py`
- Test: `ai-service/tests/test_abstention.py`

**Interfaces:**
- `calculate_decision_score(retrieval_quality, claim_support, citation_coverage, critic_safety) -> float`.
- `decide_answer_status(score, threshold, has_evidence, has_contradiction) -> DecisionResult`.
- `compute_multi_agent_consensus(...) -> dict` remains the compatibility entry point but returns the typed decision fields and an explicit `score_components` object.

- [ ] **Step 1: Write failing decision tests**

Cover these exact cases:

```python
assert decide_answer_status(0.92, 0.80, True, False).status == "answer"
assert decide_answer_status(0.65, 0.80, True, False).status == "partial"
assert decide_answer_status(0.92, 0.80, True, True).status == "abstain"
assert decide_answer_status(0.92, 0.80, False, False).status == "abstain"
```

Also test that claim support, citation coverage, retrieval quality, and critic safety each affect the score and that no free-form critic keyword can change the result.

- [ ] **Step 2: Run the tests to verify failure**

Run:

```powershell
python -m pytest ai-service/tests/test_consensus.py ai-service/tests/test_abstention.py -q
```

Expected: FAIL against the current string-matching consensus implementation.

- [ ] **Step 3: Implement the deterministic score and decision layer**

Use versioned weights with defaults `claim_support=0.35`, `citation_coverage=0.25`, `retrieval_quality=0.20`, and `critic_safety=0.20`. Store the weights and threshold in the response. The threshold is a configuration value that later experiments calibrate on a validation split; it must not be tuned on the test set.

- [ ] **Step 4: Make abstention fail closed**

Return no synthesized answer when evidence is absent, claims are contradicted, parsing fails, or the calibrated threshold is not met. Include `abstention_reason`, `verified_claim_count`, `unsupported_claim_count`, and `evidence_ids` for auditability.

- [ ] **Step 5: Rename the deterministic trust signal**

Keep the current similarity average as `retrieval_provenance_score` and expose it separately from `decision_score`. Do not label it factual trust. Update backend types and frontend labels in Task 4.

- [ ] **Step 6: Run the AI test suite and commit**

```powershell
python -m pytest ai-service/tests -q
git add ai-service/app/consensus ai-service/app/agents/trust_assessor.py ai-service/app/api/rag.py ai-service/tests/test_consensus.py ai-service/tests/test_abstention.py
git commit -m "feat: add evidence-gated answer and abstention decisions"
```

### Task 4: Align backend contracts and frontend presentation

**Files:**
- Modify: `backend/src/types/index.ts`
- Modify: `backend/src/controllers/chat.controller.ts`
- Modify: `src/lib/api-client.ts`
- Modify: `src/routes/app.chat.tsx`
- Modify: `src/routes/app.evaluations.tsx`
- Test: `test/research-response-contract.test.mjs`

**Interfaces:**
- Backend and frontend consume `decision.status`, `decision_score`, `score_components`, `abstention_reason`, and `evidence_sources`.
- Existing `confidence_score` remains temporarily as a compatibility alias but is labeled “decision confidence,” not “truth.”

- [ ] **Step 1: Write the failing response-contract test**

Assert that a successful response displays verified evidence and a decision score, while an abstention response displays the reason and no generated answer. Assert that the UI does not render the old “trust proves correctness” copy.

- [ ] **Step 2: Run the test to verify failure**

```powershell
node --test test/research-response-contract.test.mjs
```

- [ ] **Step 3: Add typed response fields**

Update TypeScript types and controller persistence so the full decision object is retained in conversation/audit records without removing existing fields used by deployed clients.

- [ ] **Step 4: Update the chat and evaluation UI**

Show `Answer`, `Partial`, or `Abstained`; show evidence IDs and source pages; label retrieval provenance separately from decision confidence; show score components and the abstention reason. Keep external Tavily evidence visibly separate from selected-document evidence.

- [ ] **Step 5: Run frontend tests, type checking, and formatting**

```powershell
node --test test/frontend-no-demo.test.mjs test/research-response-contract.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run lint
```

- [ ] **Step 6: Commit**

```powershell
git add backend/src src test/research-response-contract.test.mjs
git commit -m "feat: expose evidence-gated research decisions in the UI"
```

### Task 5: Build the reproducible evaluation harness

**Files:**
- Create: `experiments/README.md`
- Create: `experiments/configs/baseline-rag.json`
- Create: `experiments/configs/multi-agent-rag.json`
- Create: `experiments/configs/trustrag.json`
- Create: `experiments/datasets/trustrag-v1.schema.json`
- Create: `experiments/runner.py`
- Create: `experiments/metrics.py`
- Create: `experiments/bootstrap.py`
- Create: `experiments/tests/test_metrics.py`
- Create: `experiments/tests/test_runner_config.py`

**Interfaces:**
- Dataset records contain `id`, `documents`, `question`, `answer_type`, `gold_answer`, `gold_evidence_ids`, and `dataset_version`.
- `run_experiment(config_path, dataset_path, output_dir) -> pathlib.Path` writes `config.json`, `predictions.jsonl`, `metrics.json`, and `run-manifest.json`.
- `calculate_metrics(predictions) -> dict` returns correctness, support, citation, abstention, latency, and cost metrics.

- [ ] **Step 1: Write metric unit tests**

Test exact expected values for Recall@K, citation precision/recall, abstention coverage, selective risk, Brier score, ECE, latency averages, and paired bootstrap confidence intervals using a five-record fixture.

- [ ] **Step 2: Run metric tests to verify failure**

```powershell
python -m pytest experiments/tests/test_metrics.py -q
```

- [ ] **Step 3: Implement pure metric functions**

Implement metrics without provider calls. Every metric must accept explicit labels and predictions and must return sample count and denominator details so small-sample results cannot be misread.

- [ ] **Step 4: Add immutable experiment configurations**

Define the baseline settings exactly: same corpus, same Gemini embedding model, same generator model, `top_k=5`, chunk size `400`, overlap `80`, temperature `0.1`, and seed `42`. The full TrustRAG configuration enables typed verification, calibrated thresholding, and conditional external verification.

- [ ] **Step 5: Implement the runner and manifest**

The runner must record Git commit SHA, Python version, configuration hash, dataset hash, model IDs, prompt version, timestamps, response status, latency, token/cost metadata when available, and redacted error class. It must refuse to run if required secret variables are missing rather than writing a partially valid result.

- [ ] **Step 6: Run the harness tests and commit**

```powershell
python -m pytest experiments/tests -q
git add experiments
git commit -m "feat: add reproducible TrustRAG evaluation harness"
```

### Task 6: Create the benchmark and baseline/ablation matrix

**Files:**
- Create: `experiments/datasets/trustrag-v1.jsonl`
- Create: `experiments/datasets/README.md`
- Create: `experiments/configs/ablations.json`
- Create: `experiments/prompts/README.md`
- Modify: `experiments/README.md`
- Test: `experiments/tests/test_dataset.py`

**Interfaces:**
- `trustrag-v1` contains 200 reviewed records: 100 answerable, 50 unanswerable, 25 conflicting-evidence, and 25 prompt-injection documents.
- Every answerable record has at least one gold evidence ID; every unanswerable record has an empty gold evidence list and an abstention label.
- Dataset validation rejects duplicate IDs, missing labels, leaked API keys, and unsupported answer types.

- [ ] **Step 1: Write dataset validation tests**

Test counts, required fields, unique IDs, gold evidence references, and secret-pattern rejection.

- [ ] **Step 2: Run validation before adding records**

```powershell
python -m pytest experiments/tests/test_dataset.py -q
```

- [ ] **Step 3: Build and review the 200-record JSONL dataset**

Use project-owned or redistributable documents. Store the document snapshot hash and annotation rubric in `experiments/datasets/README.md`. Have two reviewers independently verify answer type, gold answer, and supporting evidence for at least 100 records; record disagreements and resolution decisions.

- [ ] **Step 4: Add the exact experiment matrix**

Run vanilla RAG, citation RAG, multi-agent RAG without decision gating, TrustRAG without external verification, full TrustRAG, and the component ablations for critic, provenance signal, consensus, and abstention.

- [ ] **Step 5: Validate and commit the benchmark**

```powershell
python -m pytest experiments/tests -q
git add experiments/datasets experiments/configs/ablations.json experiments/prompts
git commit -m "research: add versioned benchmark and ablation matrix"
```

### Task 7: Add calibration, security, and failure-analysis reports

**Files:**
- Create: `experiments/reports/README.md`
- Create: `experiments/security/prompt-injection-v1.jsonl`
- Create: `experiments/security/run-security-eval.py`
- Create: `experiments/reports/render-results.py`
- Create: `docs/research-limitations.md`
- Test: `experiments/tests/test_security_dataset.py`

**Interfaces:**
- Security outputs record attack ID, input hash, answer status, evidence leakage result, tenant scope result, and failure category without storing sensitive document content.
- Reports contain confidence intervals, calibration diagrams data, cost/latency breakdown, and manually reviewed failure examples.

- [ ] **Step 1: Write security dataset tests**

Reject secrets and require test categories for instruction injection, citation spoofing, cross-tenant identifiers, unsupported claims, and contradictory documents.

- [ ] **Step 2: Implement the security runner**

Run each attack against two different tenant IDs and assert that retrieved evidence never crosses the tenant boundary. Record whether the service abstains or incorrectly follows document instructions.

- [ ] **Step 3: Add calibration and error reports**

Generate reliability-bin data, ECE, Brier score, coverage-risk curves, paired bootstrap intervals, cost/latency charts, and a failure taxonomy: retrieval miss, unsupported generation, incorrect abstention, false consensus, parser failure, provider failure, and prompt injection.

- [ ] **Step 4: Document limitations**

State model/provider dependence, judge bias, external-search leakage risk, benchmark size, domain scope, and the difference between retrieval confidence and factual correctness.

- [ ] **Step 5: Run the report tests and commit**

```powershell
python -m pytest experiments/tests -q
git add experiments/security experiments/reports docs/research-limitations.md
git commit -m "research: add calibration and security evaluation reports"
```

### Task 8: Produce the paper package and final verification

**Files:**
- Create: `paper/outline.md`
- Create: `paper/reproducibility-checklist.md`
- Create: `paper/tables/README.md`
- Modify: `README.md`
- Test: `test/research-release.test.mjs`

**Interfaces:**
- The paper package references only committed dataset versions, experiment manifests, and generated metrics.
- The release test rejects secrets, empty or fabricated result values, unsupported “eliminates hallucinations” claims, and citations to nonexistent files.

- [ ] **Step 1: Write the paper outline**

Use sections: abstract, introduction, related work, method, system architecture, dataset, baselines, metrics, results, ablations, calibration, security, limitations, reproducibility, and conclusion. State the contribution as evidence-gated answer/abstain decision-making.

- [ ] **Step 2: Generate results from clean configurations**

Run every baseline and ablation from a clean checkout, preserve the manifests and raw JSONL outputs, and generate tables only from those outputs. Do not manually type values into the paper.

- [ ] **Step 3: Run the complete verification suite**

```powershell
node --test test/frontend-no-demo.test.mjs test/deployment-config.test.mjs test/research-documentation.test.mjs test/research-response-contract.test.mjs test/research-release.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run lint
python -m pytest ai-service/tests experiments/tests -q
```

- [ ] **Step 4: Complete the reproducibility checklist**

Verify dataset hash, configuration hash, Git SHA, model IDs, prompt version, sample counts, confidence intervals, cost/latency logs, security results, and redaction checks.

- [ ] **Step 5: Commit the paper package**

```powershell
git add paper README.md test/research-release.test.mjs
git commit -m "docs: add reproducible TrustRAG paper package"
```

## Self-Review Checklist

- The current product flow remains functional because new decision fields are additive and existing response fields remain compatible.
- The old text-based consensus heuristic is removed from the research path and covered by regression tests.
- The benchmark includes answerable, unanswerable, contradictory, and prompt-injection cases.
- The full system is compared with a same-retriever baseline and component ablations.
- Confidence is evaluated against labels rather than presented as intrinsic truth.
- Runtime documentation no longer claims unused ChromaDB, BGE, BM25, Ollama, or LangGraph components.
- No task requires an unspecified dependency, secret, private document, or manual result editing.
- The remaining gap after this plan is publication review and venue-specific formatting, not missing core research evidence.
