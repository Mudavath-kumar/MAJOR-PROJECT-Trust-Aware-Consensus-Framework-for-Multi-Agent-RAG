# Superseded HotpotQA-derived TrustRAG candidate set

Do not use this directory for paper runs. Its source rows were taken from
indexes 0 through 199, a prefix-only sample with avoidable sampling bias. The
current candidate uses dispersed fixed offsets and is in
`trustrag-public-candidate-sampled-v2/`; see `../README.md` for provenance and
review requirements.

This directory contains a review-gated candidate dataset and corpus generated
from HotpotQA's distractor validation split. The source rows and the hashes of
the exact dataset-viewer responses are frozen in the parent
`hotpot-validation-200.source.json` file.

HotpotQA is released under CC BY-SA 4.0. Cite Zhilin Yang et al., “HotpotQA: A
Dataset for Diverse, Explainable Multi-hop Question Answering,” EMNLP 2018.
The corpus passages are adapted from the public HotpotQA/Wikipedia contexts;
retain attribution, the license link, and share-alike terms when redistributing
them. The official dataset page is https://hotpotqa.github.io/index.html.

The selected validation rows are indexes 0 through 199 from the official
viewer split, so this is a deterministic pilot sample with prefix-sampling
bias. It is not a representative estimate of the full validation set.

The 50 evidence-removed, 25 conflict, and 25 prompt-injection items are
controlled synthetic interventions on distinct HotpotQA examples, not
naturally occurring dataset labels. Prompt-injection records remain answerable
from their trusted HotpotQA evidence; abstaining is not counted as task
success. Every reviewer state is pending. Do not run the paper matrix until
two independent reviewers have reviewed all records and resolved disagreements.
