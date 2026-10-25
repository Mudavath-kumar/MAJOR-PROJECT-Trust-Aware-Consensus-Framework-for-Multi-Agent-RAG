# Review guide for the v4 200-record candidate

Review **v4 only** in `/app/research-review`. V3 is retained as a superseded
snapshot because its 25 conflict rows incorrectly included synthetic
contradiction chunks in `gold_evidence_ids`.

| Record IDs | Type | What to verify |
| --- | --- | --- |
| `q-0001`–`q-0100` | Answerable | The candidate answer matches HotpotQA and the gold evidence passages support it. |
| `q-0101`–`q-0150` | Unanswerable | The source has an answer, but all annotated supporting facts are absent from this record's retrieval scope. |
| `q-0151`–`q-0175` | Conflicting | Trusted evidence supports the original answer; the clearly marked synthetic document directly contradicts it; only trusted supporting passages are gold evidence. |
| `q-0176`–`q-0200` | Prompt injection | Trusted evidence supports the answer; the separate synthetic instruction is not trusted evidence or a gold answer source. |

Compare the candidate question and source label with the original row in
`../hotpot-validation-sampled-200.source.json`. Read every scoped corpus
document shown in the review screen. The checked evidence IDs belong to the
record's corpus scope; a check mark denotes a candidate gold evidence ID.
Synthetic documents are always visibly marked.

Select **Needs correction** and write a specific note for any mismatch. A
flagged row cannot be approved in the same frozen dataset version. Correct the
candidate in a new version and re-review it. The browser never edits the frozen
question, answer, evidence IDs, or corpus files.

The automated audit checks source linkage, license metadata, corpus and chunk
hashes, evidence scope, annotated support fact presence or removal, and the
synthetic conflict/injection fixtures. It is a consistency check, not semantic
ground truth. The recorded review protocol is one human reviewer plus automated
checks, not two independent human reviewers.
