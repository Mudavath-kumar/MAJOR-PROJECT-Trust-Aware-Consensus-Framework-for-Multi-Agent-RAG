# TrustRAG research evaluation

This directory evaluates labelled predictions. It is intentionally separate
from production MongoDB collections and never reads provider credentials.

## What to report in the paper

Do not use the dashboard's `confidence`, `consensus`, similarity, or
`decision_score` as accuracy. Those are runtime decision signals. The paper
should report the following metrics from a reviewed test set. The tables show
per-system stratified bootstrap 95% confidence intervals and metric-specific
denominators; `comparison.json` separately records paired system-minus-baseline
intervals for comparable metrics:

| Family | Metric | Definition |
| --- | --- | --- |
| Answer quality | `answer_exact_match` | Normalized exact match on answerable questions |
| Answer quality | `answer_token_f1` | Token-level F1 on answerable questions |
| Prompt-injection resilience | `injection_task_success_rate` | Injection cases answered correctly from trusted evidence without abstaining; a task-preservation measure, not a complete attack-compliance audit |
| Retrieval | `retrieval_recall_at_k` | Gold evidence recovered in the first `k` retrieved chunks |
| Grounding | `citation_precision`, `citation_recall` | Whether cited chunks match reviewed gold evidence |
| Grounding | `grounded_answer_rate` | Answerable outputs with at least one cited gold-evidence chunk; evidence overlap is not claim entailment |
| Safety | `verifier_rejected_claim_rate` | Claims rejected by the verifier divided by claims it actually reviewed; N/A where no verifier labels exist. This is not a human-labelled hallucination rate |
| Safety | `unsafe_acceptance_rate` | Unsafe questions accepted instead of abstained; operational hallucination-risk proxy |
| Abstention | `abstention_coverage` | Unsafe questions correctly abstained from |
| Abstention | `coverage` | Fraction of all questions answered rather than abstained |
| Abstention | `selective_risk` | Error rate among accepted answerable answers |
| Calibration | `brier_score`, `expected_calibration_error` | Calibration of the decision score against gold answerability |
| Operations | latency `mean/p50/p95`, `llm_calls_per_query`, `verification_rate`, `retrieval_calls_per_query`, measured cost `mean/total` | Reliability and orchestration trade-offs; cost is `N/A` until every prediction has usage and pricing telemetry, never a fabricated zero |

Prompt-injection cases are answerable resilience tests: the context contains
an untrusted instruction, while the question still has a supported gold answer.
They contribute to answer quality, retrieval, citation, selective-risk, and
calibration denominators; they are not counted as cases that should always be
abstained from. `injection_task_success_rate` measures correct task completion
under injection, not whether every malicious instruction was followed. A
claim-level attack-compliance rate requires separate human annotations.

`verification_rate` means the fraction of queries that invoked typed claim
verification. It does not mean Tavily/external verification. `brier_score` and
`expected_calibration_error` compare the system's decision score with gold
answerability; the score is an operational heuristic, not a calibrated
probability. Report these as decision-score diagnostics, not model confidence.
`grounded_answer_rate` is a gold-citation overlap measure, not proof that every
claim is entailed. A human-labelled hallucination rate is intentionally omitted
until independent claim-level annotations exist.

The report generator exports both tables as CSV, LaTeX, and JSON from the same
prediction artifacts. Its tables include exact match, token F1, retrieval
recall, citation precision/recall, gold-evidence citation overlap,
verifier-rejected-claim rate, unsafe acceptance/abstention, coverage, selective
risk, decision-score Brier/ECE, latency mean/p50/p95, LLM calls, typed
verification rate, and retrieval calls. Rows include overall N plus answerable,
unsafe, accepted-answerable, gold/cited evidence, claim, and verifier-reviewed
claim denominators. Unavailable values appear as
`N/A`; the report does not invent a human hallucination rate or unmeasured cost.

The primary comparison should be selective risk at matched coverage. Secondary
comparisons should include token F1, retrieval recall, citation recall, unsafe
abstention coverage, p95 latency, and estimated cost. Do not hide the trade-off
inside one arbitrary composite score. If a single summary is needed for the
UI, keep it separate from the paper's primary result.

Do not label `verifier_rejected_claim_rate` as unsupported-claim or hallucination
rate in the paper. Those require independent human claim annotations against
the source documents. The current evidence-overlap metric also does not measure
whether every answer claim is entailed by its cited passage.

## Dataset contract

Each JSONL dataset record needs:

```json
{
  "id": "q-0001",
  "dataset_version": "trustrag-v1",
  "question": "...",
  "answer_type": "answerable",
  "gold_answer": "...",
  "gold_evidence_ids": ["doc-1:chunk-3"],
  "documents": [{"document_id": "doc-1", "snapshot_sha256": "..."}]
}
```

Use these answer types: `answerable`, `unanswerable`, `conflicting`, and
`prompt_injection`. The planned paper benchmark has 200 reviewed records:
100 answerable, 50 unanswerable, 25 conflicting, and 25 prompt-injection
cases. This repository workflow records one human reviewer plus automated
consistency checks; state that limitation explicitly and do not imply two
independent reviewers.

The repository contains a corrected public-data-derived, 200-record review candidate at
`experiments/datasets/trustrag-public-candidate-v4/` and its frozen HotpotQA
source snapshot. Review it in the authenticated console at
`/app/research-review`. The app saves one human decision per row, shows the
automated consistency audit, and enables JSONL export only after all 200 rows
are approved. The export protocol is `one-human-plus-automated`; it is not a
two-reviewer review. Automated checks prove data consistency, not semantic
correctness. The earlier prefix-only candidate is superseded. Read the
candidate README and dataset documentation for attribution, interventions, and
sampling limitations.

Build the initial project-document manifest and review-gated draft with:

```powershell
ai-service/.venv/Scripts/python.exe -m experiments.dataset_builder `
  --sources experiments/corpus-sources.json `
  --manifest experiments/datasets/trustrag-v1.manifest.json `
  --draft experiments/datasets/trustrag-project-draft.jsonl `
  --record-count 200
```

After reviewing each record and downloading the reviewed JSONL export, pass it
to the matrix command with the v4 corpus manifest. The runner verifies the
export against the checked-in frozen candidate, source snapshot, corpus hashes,
and its one-human-plus-automated review audit before the first provider call.
It executes all six variants on the exact same records, then writes the
comparison report. A full run is 1,200 question executions (200 per variant)
and may incur model-provider charges:

```powershell
ai-service/.venv/Scripts/python.exe -m experiments.run_matrix `
  --dataset path/to/trustrag-public-candidate-v4-reviewed.jsonl `
  --manifest experiments/datasets/trustrag-public-candidate-v4/trustrag-v1.manifest.json `
  --output-dir runs/paper-v1
```

The command refuses an unreviewed/wrong-size dataset or a non-empty output
directory. Outputs land in `runs/paper-v1/<variant>/`; tables are written to
`runs/paper-v1/report/` as overall and answer-type-stratified CSV, LaTeX, and
JSON. Paper-mode per-question artifacts retain retrieved passage text, evidence
IDs, citations, structured stage decisions, raw outputs returned by model
stages, latency, and observed provider/model attempts. Smoke runs omit passage
text and raw stage outputs. If a provider call fails, that
variant gets an error manifest with the failed record and observed attempts;
completed predictions are preserved as `predictions-input.partial.jsonl`.
Partial/error runs cannot produce a paper comparison. Fix the provider/config
issue and rerun into a new output directory.

## Run an experiment

First run each configured system against the same dataset and save one
prediction JSONL record per dataset ID. A prediction must contain:

```json
{
  "id": "q-0001",
  "predicted_answer": "...",
  "retrieved_evidence_ids": ["doc-1:chunk-3"],
  "retrieved_evidence": [{"chunk_id": "doc-1:chunk-3", "text": "...", "similarity_score": 0.84}],
  "predicted_evidence_ids": ["doc-1:chunk-3"],
  "agent_outputs": [{"stage": "researcher", "output": {"raw_output": "..."}}],
  "status": "answer",
  "decision_score": 0.84,
  "claims": [{"supported": true}],
  "latency_ms": 1420,
  "llm_calls": 5,
  "verification_calls": 1,
  "retrieval_calls": 1,
  "estimated_cost_usd": 0.002
}
```

Then run:

```powershell
ai-service/.venv/Scripts/python.exe -m experiments.runner `
  --config experiments/configs/trustrag.json `
  --dataset experiments/datasets/trustrag-v1.jsonl `
  --predictions runs/trustrag-v1/predictions-input.jsonl `
  --output-dir runs/trustrag-v1
```

The runner writes `config.json`, `predictions.jsonl`, `metrics.json`, and
`run-manifest.json`. The manifest records the Git revision, dataset/config/
prediction hashes, system/model/embedding identifiers, prompt version,
temperature, retrieval settings, seed, timestamp, and sample count. It refuses
missing labels, duplicate IDs, and secret-like values. `metrics.json` also
contains denominator counts so small samples cannot be mistaken for reliable
population estimates.

Confidence intervals are computed from the same labelled records, never typed
into a paper by hand:

```python
from experiments.bootstrap import bootstrap_metric_ci, paired_metric_ci

single_system_ci = bootstrap_metric_ci(records, "answer_token_f1", seed=42)
baseline_vs_trustrag_ci = paired_metric_ci(
    baseline_records, trustrag_records, "answer_token_f1", seed=42
)
```

`paired_metric_ci` returns the interval for `first - second`, matched by
question ID. Use the same IDs, corpus, split, and retrieval settings for every
system comparison.

## Experimental comparison

Run every system on the same question IDs and corpus. The paper comparison
names map to the checked-in configurations as follows:

| Paper row | Configuration | Pipeline contract |
| --- | --- | --- |
| StandardRAG | `configs/baseline-rag.json` | Single-pass retrieval and generation; no reranking, verification, or abstention gate |
| RerankedRAG | `configs/reranked-rag.json` | Single-pass retrieval with the declared hybrid reranking strategy; no verification or abstention gate |
| RAG+Verification | `configs/rag-verification.json` | Single-pass retrieval/generation with typed claim verification; no multi-agent consensus or abstention gate |
| FixedMulti-AgentRAG | `configs/multi-agent-rag.json` | Fixed multi-agent roles with typed verification; no trust-aware decision gate |
| TrustRAG without external verification | `configs/trustrag-no-external.json` | Trust-aware consensus and abstention without external search |
| Trust-AwareConsensusRAG | `configs/trustrag.json` | Trust-aware consensus, typed verification, abstention gate, and conditional external verification |

These JSON files define reproducible contracts; they do not manufacture
predictions or paper numbers. The adapter honors each variant contract:
Standard/Reranked are single-pass; RAG+Verification and FixedMulti-Agent retain
the generated answer when a verifier flags claims (the verifier result remains
in the record, and neither baseline applies TrustRAG's abstention gate); only
TrustRAG variants use consensus gating. FixedMulti-Agent records critic
diagnostics but does not use them to gate that baseline. A configuration
passing validation is not evidence that a system has been run.

The repository contains a 200-record v4 review candidate, but all candidate
rows remain pending in the checked-in JSONL and no eligible prediction runs
are present. A completed human-reviewed export and paper runs still need to be
created. Never fill the paper table from a dashboard screenshot or from these
config files.

The full research matrix is:

1. `baseline-rag`: one retrieval + one generation pass.
2. `reranked-rag`: one retrieval/reranking + one generation pass.
3. `rag-verification`: single-pass generation with typed claim verification.
4. `multi-agent-rag`: fixed roles without the trust-aware decision gate.
5. `trustrag-no-external`: typed verification and abstention without Tavily.
6. `trustrag`: the full system with conditional external verification.
7. Ablations: remove claim verification, remove the critic, remove provenance,
   and remove the abstention gate one at a time.

Use a fixed seed and frozen test set. Calibrate the abstention threshold only
on the development split; never tune it on the test split. Report mean values,
per-system confidence intervals, paired baseline-difference intervals, and
the metric-specific denominator for every result.
