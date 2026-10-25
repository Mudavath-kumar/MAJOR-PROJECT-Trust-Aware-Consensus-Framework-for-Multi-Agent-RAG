import json
from pathlib import Path

import pytest

from experiments.runner import load_and_validate_config, merge_predictions, run_experiment


CONFIG_DIR = Path(__file__).parents[1] / "configs"


def test_config_requires_reproducibility_fields(tmp_path):
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({"name": "incomplete"}), encoding="utf-8")

    with pytest.raises(ValueError, match="dataset_version"):
        load_and_validate_config(config_path)


@pytest.mark.parametrize(
    ("filename", "orchestration", "reranking", "verification"),
    [
        ("baseline-rag.json", "single-pass", False, "none"),
        ("reranked-rag.json", "single-pass", True, "none"),
        ("rag-verification.json", "single-pass", False, "typed-claims"),
        ("multi-agent-rag.json", "fixed-multi-agent", False, "typed-claims"),
        ("trustrag-no-external.json", "trust-aware-consensus", False, "typed-claims"),
        ("trustrag.json", "trust-aware-consensus", False, "typed-claims"),
    ],
)
def test_comparison_configs_declare_distinct_pipeline_modes(
    filename, orchestration, reranking, verification
):
    config = load_and_validate_config(CONFIG_DIR / filename)

    assert config["orchestration"]["mode"] == orchestration
    assert config["retrieval"]["reranking"]["enabled"] is reranking
    assert config["verification"]["mode"] == verification


def test_trustrag_external_verification_variants_are_explicit():
    without_external = load_and_validate_config(CONFIG_DIR / "trustrag-no-external.json")
    full = load_and_validate_config(CONFIG_DIR / "trustrag.json")

    assert without_external["retrieval"]["external_verification"] is False
    assert full["retrieval"]["external_verification"] is True


def test_merge_predictions_rejects_missing_or_duplicate_ids():
    dataset = [
        {"id": "q1", "answer_type": "answerable", "gold_answer": "A", "gold_evidence_ids": ["c1"]}
    ]

    with pytest.raises(ValueError, match="missing predictions"):
        merge_predictions(dataset, [])

    with pytest.raises(ValueError, match="duplicate"):
        merge_predictions(
            dataset,
            [
                {"id": "q1", "predicted_answer": "A", "status": "answer"},
                {"id": "q1", "predicted_answer": "A", "status": "answer"},
            ],
        )


def test_run_experiment_writes_reproducible_artifacts(tmp_path):
    config_path = tmp_path / "config.json"
    dataset_path = tmp_path / "dataset.jsonl"
    predictions_path = tmp_path / "predictions.jsonl"
    output_dir = tmp_path / "run"
    config_path.write_text(
        json.dumps(
            {
                "name": "smoke",
                "dataset_version": "smoke-v1",
                "system": "trustrag",
                "model": "test-model",
                "embedding_model": "test-embedding",
                "prompt_version": "test-prompt-v1",
                "temperature": 0.1,
                "retrieval": {
                    "top_k": 2,
                    "chunk_size": 400,
                    "chunk_overlap": 80,
                    "reranking": {"enabled": False},
                },
                "orchestration": {"mode": "single-pass"},
                "verification": {"mode": "none"},
                "seed": 42,
            }
        ),
        encoding="utf-8",
    )
    dataset_path.write_text(
        json.dumps(
            {
                "id": "q1",
                "dataset_version": "smoke-v1",
                "question": "What is the capital of France?",
                "answer_type": "answerable",
                "gold_answer": "Paris",
                "gold_evidence_ids": ["c1"],
                "documents": [
                    {
                        "document_id": "doc-1",
                        "snapshot_sha256": "a" * 64,
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    predictions_path.write_text(
        json.dumps(
            {
                "id": "q1",
                "predicted_answer": "Paris",
                "retrieved_evidence_ids": ["c1"],
                "predicted_evidence_ids": ["c1"],
                "status": "answer",
                "decision_score": 0.9,
                "latency_ms": 100,
                "claims": [{"supported": True}],
                "estimated_cost_usd": 0.01,
                    "llm_calls": 1,
                    "verification_calls": 0,
                    "retrieval_calls": 1,
            }
        )
        + "\n",
        encoding="utf-8",
    )

    run_experiment(config_path, dataset_path, predictions_path, output_dir)

    assert (output_dir / "config.json").exists()
    assert (output_dir / "predictions.jsonl").exists()
    assert json.loads((output_dir / "metrics.json").read_text(encoding="utf-8"))["sample_count"] == 1
    manifest = json.loads((output_dir / "run-manifest.json").read_text(encoding="utf-8"))
    assert manifest["dataset_version"] == "smoke-v1"
    assert manifest["sample_count"] == 1
    assert manifest["model"] == "test-model"
    assert manifest["embedding_model"] == "test-embedding"
    assert manifest["prompt_version"] == "test-prompt-v1"
    assert manifest["temperature"] == 0.1
    assert manifest["retrieval"]["top_k"] == 2
    assert manifest["retrieval"]["reranking"]["enabled"] is False
    assert manifest["orchestration"]["mode"] == "single-pass"
    assert manifest["verification"]["mode"] == "none"
    assert manifest["seed"] == 42
