# HotpotQA-derived TrustRAG review candidate (v3)

> Superseded by v4. V3's 25 conflict rows incorrectly include a synthetic
> contradiction chunk in `gold_evidence_ids`. Do not review or use v3 for paper
> runs. It is retained as an immutable audit snapshot.

This is the current 200-record candidate generated from the frozen public
HotpotQA distractor validation sample. All records remain pending review; this
is not paper results.

Use the authenticated TrustRAG console at `/app/research-review` to inspect
records and save decisions in MongoDB. The screen shows source labels, the
scoped corpus, synthetic challenges, review progress, and the export gate.
Read [REVIEW-GUIDE.md](REVIEW-GUIDE.md) for the exact per-category checks. The source
questions and labels are in
`../hotpot-validation-sampled-200.source.json`; scoped evidence and synthetic
challenge documents are in `corpus/`.

The sample has 100 answerable, 50 unanswerable-by-scoped-evidence, 25
controlled conflict, and 25 prompt-injection resilience records. The conflict
generator was corrected in v3: each synthetic claim directly denies the
source answer (or flips yes/no), rather than using an unrelated context title.
All 25 generated conflict records were checked against that rule. The full
candidate also passed automated source, evidence-scope, and supporting-fact
consistency checks. These are AI/programmatic checks, not human semantic
approval.

HotpotQA is distributed under CC BY-SA 4.0. Retain attribution and share-alike
terms when redistributing derived passage text. See the
[official HotpotQA page](https://hotpotqa.github.io/index.html).

The approved export records one human reviewer plus automated consistency
checks. The automated checks do not prove semantic correctness or independent
reviewer agreement. Dataset approval is separate from running the six paper
variants and collecting their result tables.
