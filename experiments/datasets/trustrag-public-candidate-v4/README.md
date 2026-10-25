# HotpotQA-derived TrustRAG review candidate (v4)

This corrected 200-record candidate is derived from the frozen HotpotQA
distractor validation sample. All review states are pending; this is not paper
results. Review it in the authenticated TrustRAG console at
`/app/research-review`.

The composition is 100 answerable, 50 unanswerable from the scoped evidence,
25 controlled conflicts, and 25 prompt-injection resilience cases. In v4,
synthetic conflict chunks remain in the retrieval scope but are excluded from
`gold_evidence_ids`; the v3 mistake is preserved in the superseded v3 snapshot
for reproducibility.

The app records one human reviewer plus a separately versioned automated
consistency audit. Those checks verify provenance and data integrity; they do
not establish semantic correctness or reviewer agreement. The reviewed export
is separate from running the six evaluation variants.

HotpotQA is distributed under CC BY-SA 4.0. Retain attribution and share-alike
terms when redistributing derived passage text. See the
[official HotpotQA page](https://hotpotqa.github.io/index.html).
