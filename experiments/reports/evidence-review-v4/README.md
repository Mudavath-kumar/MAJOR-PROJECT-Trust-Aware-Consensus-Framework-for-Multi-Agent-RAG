# TrustRAG v4 evidence review package

This package contains all 200 candidate records split into eight batches of 25. Each batch has a JSON file with structured evidence and a Markdown report for human reading.

## Files

- `evidence-review-batch-01.json` through `evidence-review-batch-08.json`
- Matching `.md` reports
- `validation-report.json`

## What is included

- Exact IDs, questions, labels, gold answers, and evidence IDs from the v4 candidate.
- Verbatim corpus chunks reconstructed from the frozen manifest; each chunk hash matches its manifest hash.
- Source document filename and article section heading. The snapshots do not contain page numbers.
- Synthetic conflict passages and prompt-injection passages separated from trusted gold evidence.
- For unanswerable cases, the original annotated supporting passages are shown as excluded reference material, with an explanation that a reviewer must confirm they are absent from the query scope and that no other scoped text answers the question.

## Validation and limitations

- 200 records and 200 unique IDs.
- Category counts: 100 answerable, 50 unanswerable, 25 conflicting, 25 prompt-injection.
- All 200 remain pending; this export records no human approval.
- No missing gold evidence IDs, missing document references, snapshot hash mismatches, or evidence chunk hash mismatches were found.
- Structural provenance checks cannot establish that each answer is semantically correct or fully supported. The JSON marks semantic support as requiring human review. Do not treat a matching chunk hash as answer verification.

Review each record against its exact question, gold answer, cited passage, challenge passage, and query scope. Record corrections in the review workflow; do not edit this evidence export to imply approval.
