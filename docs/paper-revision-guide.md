# TrustRAG Paper Revision and Results-Fill Guide

Audit date: 2026-10-24
Paper reviewed: `RAG-Paper.pdf`
Scope: corrections needed to align the manuscript with this repository and a safe plan for replacing its `TBD`/`TBA` cells.

## Bottom line

The paper is not ready to submit with its current results tables. The repository has evaluation code and six variant configurations, but it does not contain a reviewed benchmark dataset or completed paper-eligible prediction runs. The generated 200-row dataset is a review draft: its questions are placeholders, gold answers/evidence are empty, and both reviewers are still pending. No accuracy, groundedness, hallucination, calibration, latency, or cost result can honestly be filled from the dashboard, config files, or smoke tests.

Use `NOT MEASURED` in the manuscript draft until the benchmark produces results. Do not convert runtime confidence, consensus, similarity, or decision scores into accuracy claims.

## Values you can put in the methods now

These are implementation/configuration facts, not experimental outcomes:

| Paper item | Current value | How to describe it |
| --- | --- | --- |
| Chunk window | 400 words | Configured chunk size |
| Chunk overlap | 80 words | Configured overlap |
| Retrieval top-k | 5 chunks | Benchmark configuration |
| Reranked candidate pool | 20 candidates | Only for the reranked variant |
| Random seed | 42 | Benchmark configuration; report any actual per-run override |
| Generation temperature | 0.1 | Benchmark configuration |
| Embedding model | `gemini-embedding-2` | Configured embedding identifier |
| Consensus score weights | claim support 0.35; citation coverage 0.25; retrieval quality 0.20; critic safety 0.20 | These weights sum to 1.0; trust-assessor output is not a score component in the current consensus implementation |
| Decision labels | `answer`, `partial`, `abstain` | Claim-verification labels are `supported`, `contradicted`, `insufficient` |
| Planned benchmark size | 200 reviewed examples | Planned only, not yet an evaluated sample |
| Planned example mix | 100 answerable, 50 unanswerable, 25 conflicting, 25 prompt-injection | Planned only; do not report as completed dataset counts |

The benchmark JSON currently requests `openai/gpt-4o-mini`, but the runtime LLM router can select the configured Gemini model or OpenRouter model instead. Verify the provider and model recorded by the run telemetry before naming the generation model in the paper. A configured value is not proof that the provider used it.

## Manuscript sections to change

| Section | Required revision |
| --- | --- |
| Abstract | Remove claims that the framework improves correctness, groundedness, or hallucination rates until a reviewed test set has been run. State the research question and method. Add numerical results only from the final report artifacts. |
| Contributions / claims | Separate implemented features from hypotheses. Do not claim trust scoring uses source authority or freshness: the current trust assessor is a deterministic retrieval/provenance heuristic, and its output is not part of the consensus formula. |
| System architecture | Replace inaccurate stack/diagram details with the deployed code path: TanStack Start/React frontend, Express/TypeScript API, FastAPI/Python AI service, MongoDB Atlas Vector Search, Backblaze B2 object storage, Gemini embeddings, and Gemini/OpenRouter generation fallback. Clerk handles frontend identity. Tavily is optional external checking, not the document store. |
| Retrieval and chunking | State the 400-word window, 80-word overlap, top-k of 5, and the actual Atlas vector retrieval plus tenant-scoped keyword-overlap fallback. Do not call that fallback BM25. Describe hybrid lexical-semantic reranking only for the reranked benchmark variant. |
| Agent pipeline | Describe the actual query path: researcher creates claims, fact-checker labels claims against retrieved evidence, critic audits unsupported claims, deterministic consensus gates the response. The reasoner module is not invoked in the current request path. Tavily is conditional and bounded; its web results are not promoted to user-document citations and it does not re-retrieve the document corpus. |
| Trust and consensus method | Replace any formula involving source freshness/authority, an independent reasoning score, or external-verification score with the implemented score: `0.35 × claim_support + 0.25 × citation_coverage + 0.20 × retrieval_quality + 0.20 × critic_safety`. Define each component and explain the threshold rule. State that the separate trust-assessor result is currently not used by this formula. |
| Labels | Use the implementation’s exact vocabularies. Claim labels: supported / contradicted / insufficient. Final decisions: answer / partial / abstain. Do not list partially-supported or unsupported as claim labels unless the code and evaluation schema are changed first. |
| Experimental setup | Add the frozen corpus and dataset version, reviewer process, train/dev/test split, threshold-calibration split, actual provider/model, prompts, seed, top-k, run revision, and sample counts from run manifests. State that thresholds are tuned on development data only. |
| Results and discussion | Replace result claims only after all variants finish on the same reviewed IDs and corpus. Include sample count and paired 95% bootstrap confidence intervals; discuss uncertainty and failures, not only means. |
| Limitations / conclusion | Say the operational scores are not calibrated accuracy until validated against labels. Do not claim reduced hallucination from `verifier_rejected_claim_rate` or evidence overlap; neither is an independent human hallucination/entailment annotation. |
| Author metadata / proofing | Replace `mudavathkumar@example.com` with a verified institutional address or remove it. Fix the stray closing quote and proofread table captions, citations, and the architecture figure. |

## Table II: answer quality, grounding, safety, and calibration

The paper’s current columns need operational definitions. Recommended names:

| Existing heading | Use this measure | Rule for reporting |
| --- | --- | --- |
| Correctness | `answer_exact_match` and `answer_token_f1` | Score answerable examples against reviewed gold answers. Give denominator and confidence interval. |
| Groundedness | `citation_precision`, `citation_recall`, and `grounded_answer_rate` | Compare cited/retrieved chunk IDs with reviewed gold evidence. Call this evidence overlap, not proof that every claim is entailed. |
| Hallucination Rate | Human-labelled unsupported-claim rate, only if claim-level human annotations are collected | If not annotated, rename this to `unsafe_acceptance_rate` and label it an operational safety proxy, not a hallucination rate. Report `verifier_rejected_claim_rate` separately as system behavior. |
| Recall@K | `retrieval_recall_at_k`, with `K=5` | Fraction of reviewed gold evidence IDs recovered in the first five retrieved chunks. State the corpus and denominator. |
| ECE | `expected_calibration_error` plus `brier_score` | Calibrate the decision score against gold answerability labels; state binning and use a development-set threshold. |
| Abstention Quality | `abstention_coverage`, `coverage`, and `selective_risk` | Report correct abstention on unsafe examples, fraction answered overall, and error among accepted answerable answers. Define the unsafe categories. |

Keep the paper’s comparison rows consistent with the actual experiment matrix. It has six system configurations, not five:

1. Standard RAG (`baseline-rag`)
2. Reranked RAG (`reranked-rag`)
3. RAG + typed verification (`rag-verification`)
4. Fixed multi-agent RAG (`multi-agent-rag`)
5. TrustRAG without external verification (`trustrag-no-external`)
6. Full TrustRAG with conditional external verification (`trustrag`)

Until the run artifacts exist, the cells below must remain `NOT MEASURED`:

| System | Exact match | Token F1 | Recall@5 | Citation precision | Citation recall | Unsafe acceptance rate | Abstention coverage | ECE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Standard RAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Reranked RAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| RAG + verification | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Fixed multi-agent RAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| TrustRAG without external verification | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Full TrustRAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |

Put confidence intervals and sample/denominator counts in the final table or a companion table. If the page is too wide, split answer quality from safety/calibration rather than dropping metrics or shrinking the text until it is unreadable.

## Table III: latency and orchestration

Define latency as end-to-end time per query and report mean, p50, and p95. Add provider cost per query if the run has defensible token/pricing inputs. For the current single `Verification Rate` column, clarify what is counted; preferably split it into:

- `internal_claim_verification_rate`: queries with at least one typed claim-verifier call divided by completed queries.
- `external_search_rate`: queries with an actual Tavily call divided by completed queries.

Keep `llm_calls_per_query` and `retrieval_calls_per_query` as measured averages from run predictions. Report counts for the same six variants and test examples used in Table II.

Do **not** enter the PDF’s apparent 0%/100% design assumptions as measured outcomes. A configured policy does not prove that the call occurred on every request. Full TrustRAG’s external verification is conditional, so its external-search rate is not inherently 100%.

| System | Latency mean / p50 / p95 | LLM calls/query | Internal verification rate | External search rate | Retrieval calls/query | Cost/query |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Standard RAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Reranked RAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| RAG + verification | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Fixed multi-agent RAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| TrustRAG without external verification | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |
| Full TrustRAG | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED |

## What must happen before replacing `NOT MEASURED`

1. Replace all draft questions; add gold answers, answerability type, and gold evidence IDs. The current 200-row draft is not a benchmark.
2. Have two reviewers independently approve every example and resolve disagreements. Keep private source text and production credentials out of artifacts.
3. Freeze/hash the corpus, dataset, prompts, configs, and actual model/provider. Confirm telemetry records the provider actually used, not just the configured model string.
4. Fix the test set and run all six variants on the same question IDs, corpus, retrieval settings, and seed. Run ablations if the paper claims the effect of individual components.
5. Calibrate the abstention threshold on development data only. Do not tune against the test results.
6. Generate metrics and paired bootstrap intervals from the saved run outputs. Confirm each report’s `paper_eligible` status, sample counts, model/provider, revision, and dataset/config hashes.
7. Replace the manuscript tables from the generated report files, then verify every number against the CSV/TeX/JSON artifacts and retain the run manifest with the paper materials.

The repository’s intended benchmark command, after the dataset review gate passes, is:

```powershell
ai-service/.venv/Scripts/python.exe -m experiments.run_benchmark `
  --config experiments/configs/trustrag.json `
  --dataset experiments/datasets/trustrag-v1.jsonl `
  --manifest experiments/datasets/trustrag-v1.manifest.json `
  --output-dir runs/trustrag `
  --paper
```

Run the same command for each comparison configuration, changing the config and output directory. The report helper currently documents five run directories; update its input list to include `trustrag-no-external` so the table matches the six-row comparison before generating final tables.

## Suggested wording for the current draft

Until the experiments are complete, use language such as:

> We implement an evidence-gated multi-agent RAG pipeline and define a reproducible comparison against single-pass, reranked, verification, and fixed multi-agent baselines. The benchmark dataset and prediction runs are not yet complete; therefore, this draft makes no empirical claim about accuracy, hallucination reduction, calibration, or latency improvements.

Replace this status wording with actual findings only after the reviewed benchmark and all six runs are complete. A paper with `NOT MEASURED` tables is a working draft, not a results-complete research paper.

## Source files checked

- `docs/research-scope.md`
- `experiments/README.md`
- `experiments/reports/README.md`
- `experiments/configs/*.json`
- `experiments/datasets/trustrag-project-draft.jsonl`
- `experiments/datasets/trustrag-v1.manifest.json`
- `ai-service/app/api/rag.py`
- `ai-service/app/consensus/decision.py`
- `ai-service/app/consensus/engine.py`
- `ai-service/app/agents/schemas.py`
- `ai-service/app/core/llm_router.py`
