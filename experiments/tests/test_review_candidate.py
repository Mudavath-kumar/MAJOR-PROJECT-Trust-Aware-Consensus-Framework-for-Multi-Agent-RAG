import json
from pathlib import Path

from experiments.review_candidate import audit_candidate, write_review_package


ROOT = Path(__file__).parents[2]
DATASET_DIR = ROOT / "experiments/datasets/trustrag-public-candidate-v4"


def test_v4_review_audit_checks_source_facts_and_keeps_semantic_flags_pending(tmp_path):
    results = audit_candidate(
        DATASET_DIR / "trustrag-project-draft.jsonl",
        ROOT / "experiments/datasets/hotpot-validation-sampled-200.source.json",
        DATASET_DIR / "trustrag-v1.manifest.json",
    )

    counts = {}
    for result in results:
        category = result["category"]
        counts.setdefault(category, {})
        counts[category][result["decision"]] = counts[category].get(result["decision"], 0) + 1

    assert len(results) == 200
    assert counts["answerable"] == {"Approved": 100}
    assert counts["conflicting"] == {"Approved": 25}
    assert counts["prompt_injection"] == {"Approved": 25}
    assert counts["unanswerable"]["Needs Review"] > 0
    assert sum(counts["unanswerable"].values()) == 50
    assert all(result["reviewer_type"] == "automated" for result in results)


def test_review_package_preserves_candidate_and_writes_decisions_separately(tmp_path):
    source = DATASET_DIR / "trustrag-project-draft.jsonl"
    original = source.read_bytes()
    outputs = write_review_package(
        source,
        ROOT / "experiments/datasets/hotpot-validation-sampled-200.source.json",
        DATASET_DIR / "trustrag-v1.manifest.json",
        tmp_path,
    )

    assert source.read_bytes() == original
    reviewed = [json.loads(line) for line in outputs["reviewed_dataset"].read_text(encoding="utf-8").splitlines()]
    assert len(reviewed) == 200
    assert all(item["review"]["reviewer_a"] == "pending" for item in reviewed)
    assert all(item["automated_review"]["reviewer_type"] == "automated" for item in reviewed)
    assert outputs["approved_dataset"].is_file()
    assert outputs["decisions"].is_file()
    assert outputs["summary"].is_file()
