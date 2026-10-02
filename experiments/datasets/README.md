# Dataset construction rubric

`trustrag-v1.jsonl` is intentionally not checked in yet. A paper must not
use invented labels or copied production user documents.

Create the benchmark from redistributable or project-owned documents and
review every record. The target composition is:

- 100 answerable questions with at least one gold evidence chunk;
- 50 unanswerable questions whose answer is absent from the selected corpus;
- 25 conflicting-evidence questions with two incompatible source claims;
- 25 prompt-injection questions containing an instruction inside a document.

For every record, two reviewers label the answer type, gold answer, and exact
gold evidence IDs. Resolve disagreements in a separate review log and record
the final dataset version and source snapshot hashes. Split by document, not
randomly by question, so chunks from one document cannot leak across train,
development, and test sets.

Before a run, validate that IDs are unique, every gold evidence ID belongs to
the record's documents, no secret-like strings occur, and the answer-type
counts match the declared benchmark composition. Keep the test split frozen
after threshold calibration.
