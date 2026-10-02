# TrustRAG research evaluation

This directory evaluates labelled predictions. It is intentionally separate
from production MongoDB collections and never reads provider credentials.

## What to report in the paper

Do not use the dashboard's `confidence`, `consensus`, similarity, or
`decision_score` as accuracy. Those are runtime decision signals. The paper
should report the following metrics from a reviewed test set, each with its
sample count and a paired bootstrap 95% confidence interval:

| Family | Metric | Definition |
| --- | --- | --- |
| Answer quality | `answer_exact_match` | Normalized exact match on answerable questions |
| Answer quality | `answer_token_f1` | Token-level F1 on answerable questions |
| Retrieval | `retrieval_recall_at_k` | Gold evidence recovered in the first `k` retrieved chunks |
| Grounding | `citation_precision`, `citation_recall` | Whether cited chunks match reviewed gold evidence |
| Grounding | `grounded_answer_rate` | Answerable answers with overlapping gold evidence |
| Safety | `unsupported_claim_rate` | Unsupported claims divided by all extracted claims |
| Safety | `unsafe_acceptance_rate` | Unsafe questions accepted instead of abstained; operational hallucination-risk proxy |
| Abstention | `abstention_coverage` | Unsafe questions correctly abstained from |
| Abstention | `coverage` | Fraction of all questions answered rather than abstained |
| Abstention | `selective_risk` | Error rate among accepted answerable answers |
| Calibration | `brier_score`, `expected_calibration_error` | Calibration of the decision score against gold answerability |
| Operations | latency `mean/p50/p95`, cost `mean/total` | Reliability and deployment trade-offs |

The primary comparison should be selective risk at matched coverage. Secondary
comparisons should include token F1, retrieval recall, citation recall, unsafe
abstention coverage, p95 latency, and estimated cost. Do not hide the trade-off
inside one arbitrary composite score. If a single summary is needed for the
UI, keep it separate from the paper's primary result.

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
cases. Do not claim those results until two reviewers have checked the labels.

The current repository contains the schema and a smoke-test path, not a fake
200-record benchmark. Build the real dataset from redistributable or
project-owned documents, hash every document snapshot, and keep private source
text out of committed artifacts.

## Run an experiment

First run each configured system against the same dataset and save one
prediction JSONL record per dataset ID. A prediction must contain:

```json
{
  "id": "q-0001",
  "predicted_answer": "...",
  "retrieved_evidence_ids": ["doc-1:chunk-3"],
  "predicted_evidence_ids": ["doc-1:chunk-3"],
  "status": "answer",
  "decision_score": 0.84,
  "claims": [{"supported": true}],
  "latency_ms": 1420,
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

Run every system on the same question IDs and corpus:

1. `baseline-rag`: one retrieval + one generation pass.
2. `multi-agent-rag`: the existing roles without the typed decision gate.
3. `trustrag-no-external`: typed verification and abstention without Tavily.
4. `trustrag`: the full system with conditional external verification.
5. Ablations: remove claim verification, remove the critic, remove provenance,
   and remove the abstention gate one at a time.

Use a fixed seed and frozen test set. Calibrate the abstention threshold only
on the development split; never tune it on the test split. Report the mean,
95% paired bootstrap interval, and the number of questions for every result.
