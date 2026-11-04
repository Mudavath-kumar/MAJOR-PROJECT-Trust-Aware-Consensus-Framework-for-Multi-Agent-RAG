# Superseded HotpotQA-derived TrustRAG candidate

Do not review or use this candidate for paper runs. Its synthetic conflict
generator could substitute an unrelated context title as an answer. The
corrected candidate is `../trustrag-public-candidate-v3/`.

This directory contains a 200-record candidate dataset and frozen corpus built
from the HotpotQA distractor validation split. The exact source rows and raw
response SHA-256 hashes are preserved in the parent file
`hotpot-validation-sampled-200.source.json`.

HotpotQA is released under CC BY-SA 4.0. Cite Zhilin Yang et al., “HotpotQA: A
Dataset for Diverse, Explainable Multi-hop Question Answering,” EMNLP 2018.
The corpus passages are adapted from the public HotpotQA/Wikipedia contexts;
retain attribution, the license link, and share-alike terms when redistributing
them. See the [official HotpotQA dataset page](https://hotpotqa.github.io/index.html).

The source consists of ten fixed 20-row blocks at offsets 204, 839, 912, 1143,
1828, 2006, 2253, 5238, 6033, and 6074 in the 7,405-row validation split.
This dispersed fixed-offset pilot is not a statistically randomized or
representative sample. Seed 42 determines category assignment order after the
source rows are frozen.

The composition is 100 answerable, 50 scoped cases with annotated supporting
facts removed, 25 controlled synthetic-conflict cases, and 25 answerable
synthetic-injection resilience cases. The latter three categories are
interventions, not native HotpotQA labels. For unanswerable records, only
annotated supporting sentences are removed; the record is answerable only
relative to its scoped corpus and still requires human validation. The
injection records keep the trusted gold answer and evidence; task success
requires a supported answer rather than abstention.

Every record's two reviewer fields and resolution are pending. Do not use this
candidate for paper results or provider matrix runs until two independent
reviewers check each question, answerability, gold answer, exact evidence IDs,
scope, and synthetic intervention and resolve disagreements. This is a
candidate, not completed evaluation evidence.
