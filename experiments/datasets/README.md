# TrustRAG paper dataset candidates

`trustrag-public-candidate-v4/trustrag-project-draft.jsonl` is the current
200-record review candidate derived from HotpotQA distractor validation. V4
corrects a v3 labeling defect: synthetic conflict chunks are not gold evidence.
V3 is retained as a superseded audit snapshot. The frozen source snapshot is
`hotpot-validation-sampled-200.source.json`; corpus text, manifest, and source
list are under the candidate directory. Earlier candidates (the prefix-only
candidate and sampled v2) are superseded; do not use them for a paper run.

HotpotQA is distributed under CC BY-SA 4.0. Cite Yang et al., “HotpotQA: A
Dataset for Diverse, Explainable Multi-hop Question Answering,” EMNLP 2018,
and preserve attribution and share-alike terms when redistributing derived
passage text. See the [official HotpotQA dataset page](https://hotpotqa.github.io/index.html).

```powershell
ai-service/.venv/Scripts/python.exe -m experiments.build_public_dataset `
  --source-snapshot experiments/datasets/hotpot-validation-sampled-200.source.json `
  --output-dir experiments/datasets/trustrag-public-candidate-rebuild
```

Use the authenticated `/app/research-review` route and read
`trustrag-public-candidate-v4/REVIEW-GUIDE.md` to inspect questions and evidence.
The conflict generator directly negates the source answer without labelling
the synthetic claim as gold support.

The generated candidate is deliberately not paper-eligible. All review states
remain pending. Matrix preflight rejects it before provider calls until the
authenticated review workflow records all 200 approvals plus a passing
consistency audit. The protocol is one human reviewer plus automated checks.

The fixed snapshot contains ten 20-row blocks at the exact row indexes in its
provenance. These indexes are dispersed across the validation split, but are
not a statistically randomized or representative sample. Seed 42 controls
assignment of the frozen source examples to benchmark categories.

The candidate composition is 100 answerable, 50 supporting-fact-removed
unanswerable, 25 controlled synthetic-conflict, and 25 controlled
synthetic-injection records. The latter three categories are interventions on
the original public examples, not naturally occurring HotpotQA labels.
Unanswerable means unanswerable from the documents scoped to that record, not
globally unknowable. Prompt-injection records retain a supported gold answer:
success means answering from trusted evidence while ignoring the synthetic
instruction. Each record marks its source and challenge type.

- 100 answerable questions with at least one gold evidence chunk;
- 50 unanswerable questions whose annotated supporting facts are removed from
  the scoped corpus (other non-supporting sentences are retained);
- 25 conflicting-evidence questions with two incompatible source claims;
- 25 prompt-injection questions containing an instruction inside a document.

For every record, the human reviewer checks answer type, gold answer, and exact
gold evidence IDs. The 200 rows are
a small deterministic sample, not a representative estimate of all RAG tasks.
Report this sampling limitation and keep the test set frozen after threshold
calibration.

Before a run, validate that IDs are unique, every gold evidence ID belongs to
the record's documents, no secret-like strings occur, and the answer-type
counts match the declared benchmark composition. Keep the test split frozen
after threshold calibration.
