import json
from pathlib import Path

import pytest

from experiments.corpus import build_corpus_manifest
from experiments.run_benchmark import _augment_manifest, run_benchmark
from experiments.run_benchmark import InMemoryRetriever


class TinyBackend:
    async def single_pass(self, query, context, profile):
        return {
            "answer": "Paris",
            "claims": [{"claim_id": "claim-1", "evidence_ids": [context[0]["chunk_id"]]}],
        }

    async def researcher(self, query, context, profile):
        return {
            "claims": [{"claim_id": "claim-1", "evidence_ids": [context[0]["chunk_id"]]}],
            "claim_propositions": ["Paris"],
            "raw_output": "research",
        }

    async def fact_checker(self, query, researcher, context, profile):
        return {
            "verifications": [
                {"claim_id": "claim-1", "label": "supported", "evidence_ids": [context[0]["chunk_id"]]}
            ]
        }

    async def critic(self, query, researcher, fact_checker, profile):
        return {"critic": {"risk": "low"}}

    async def trust_assessor(self, context):
        return {"confidence": 0.9}

    async def consensus(self, researcher, fact_checker, critic, trust_assessor, context, profile):
        return {"decision_status": "answer", "decision_score": 0.9, "synthesis": "Paris"}


class FailsOnSecondQuery(TinyBackend):
    def __init__(self):
        self.calls = 0

    async def single_pass(self, query, context, profile):
        self.calls += 1
        if self.calls == 2:
            raise RuntimeError("simulated provider failure")
        return await super().single_pass(query, context, profile)


def _dataset(manifest):
    source = manifest["sources"][0]
    return [
        {
            "id": "q-0001",
            "dataset_version": "test-v1",
            "question": "What is the answer?",
            "answer_type": "answerable",
            "gold_answer": "Paris",
            "gold_evidence_ids": [source["chunks"][0]["evidence_id"]],
            "documents": [
                {
                    "document_id": source["document_id"],
                    "snapshot_sha256": source["snapshot_sha256"],
                }
            ],
        }
    ]


def test_run_benchmark_writes_predictions_metrics_and_manifest(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("Paris is the answer to this test question.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    dataset_path = tmp_path / "dataset.jsonl"
    dataset_path.write_text("\n".join(json.dumps(item) for item in _dataset(manifest)) + "\n", encoding="utf-8")
    output_dir = tmp_path / "run"

    run_benchmark(
        "experiments/configs/baseline-rag.json",
        dataset_path,
        tmp_path / "manifest.json",
        output_dir,
        backend=TinyBackend(),
        context_provider=lambda record, profile: [
            {
                "chunk_id": manifest["sources"][0]["chunks"][0]["evidence_id"],
                "text": "Paris is the answer.",
                "similarity_score": 0.9,
                "metadata": {"document_id": manifest["sources"][0]["document_id"]},
            }
        ],
    )

    assert (output_dir / "predictions-input.jsonl").exists()
    prediction = json.loads((output_dir / "predictions-input.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert "retrieved_evidence" not in prediction
    assert "agent_outputs" not in prediction
    assert json.loads((output_dir / "metrics.json").read_text(encoding="utf-8"))["sample_count"] == 1
    run_manifest = json.loads((output_dir / "run-manifest.json").read_text(encoding="utf-8"))
    assert run_manifest["run_mode"] == "smoke"
    assert run_manifest["paper_eligible"] is False


def test_exploratory_run_can_retain_raw_evidence_without_becoming_paper_eligible(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("Paris is the answer to this test question.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    dataset_path = tmp_path / "dataset.jsonl"
    dataset_path.write_text("\n".join(json.dumps(item) for item in _dataset(manifest)) + "\n", encoding="utf-8")
    output_dir = tmp_path / "run"

    run_benchmark(
        "experiments/configs/baseline-rag.json",
        dataset_path,
        tmp_path / "manifest.json",
        output_dir,
        backend=TinyBackend(),
        retain_raw_outputs=True,
        context_provider=lambda record, profile: [
            {
                "chunk_id": manifest["sources"][0]["chunks"][0]["evidence_id"],
                "text": "Paris is the answer.",
                "similarity_score": 0.9,
                "metadata": {"document_id": manifest["sources"][0]["document_id"]},
            }
        ],
    )

    prediction = json.loads((output_dir / "predictions-input.jsonl").read_text(encoding="utf-8").splitlines()[0])
    run_manifest = json.loads((output_dir / "run-manifest.json").read_text(encoding="utf-8"))
    assert prediction["retrieved_evidence"][0]["text"] == "Paris is the answer."
    assert prediction["agent_outputs"]
    assert run_manifest["run_mode"] == "exploratory"
    assert run_manifest["raw_outputs_retained"] is True
    assert run_manifest["paper_eligible"] is False


def test_failed_run_preserves_completed_predictions_and_failed_query_context(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("Paris is the answer to this test question.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    records = _dataset(manifest)
    records.append({**records[0], "id": "q-0002", "question": "A second question?"})
    dataset_path = tmp_path / "dataset.jsonl"
    dataset_path.write_text("\n".join(json.dumps(item) for item in records) + "\n", encoding="utf-8")
    output_dir = tmp_path / "failed-run"

    with pytest.raises(RuntimeError, match="simulated provider failure"):
        run_benchmark(
            "experiments/configs/baseline-rag.json",
            dataset_path,
            tmp_path / "manifest.json",
            output_dir,
            backend=FailsOnSecondQuery(),
            context_provider=lambda record, profile: [
                {
                    "chunk_id": manifest["sources"][0]["chunks"][0]["evidence_id"],
                    "text": "Paris is the answer.",
                    "similarity_score": 0.9,
                    "metadata": {"document_id": manifest["sources"][0]["document_id"]},
                }
            ],
        )

    partial_path = output_dir / "predictions-input.partial.jsonl"
    partial_rows = [json.loads(line) for line in partial_path.read_text(encoding="utf-8").splitlines()]
    error = json.loads((output_dir / "error-manifest.json").read_text(encoding="utf-8"))
    assert [row["id"] for row in partial_rows] == ["q-0001"]
    assert error["completed_prediction_count"] == 1
    assert error["failed_record_id"] == "q-0002"
    assert error["status"] == "error"


def test_run_benchmark_paper_mode_rejects_unreviewed_dataset(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("Paris is the answer to this test question.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    dataset_path = tmp_path / "dataset.jsonl"
    dataset_path.write_text("\n".join(json.dumps(item) for item in _dataset(manifest)) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="review"):
        run_benchmark(
            "experiments/configs/baseline-rag.json",
            dataset_path,
            tmp_path / "manifest.json",
            tmp_path / "run",
            paper_mode=True,
            backend=TinyBackend(),
            context_provider=lambda record, profile: [],
        )


def test_run_benchmark_refuses_to_overwrite_existing_output(tmp_path):
    source = tmp_path / "policy.md"
    source.write_text("Paris is the answer to this test question.", encoding="utf-8")
    manifest = build_corpus_manifest([source], tmp_path / "manifest.json", "test-v1")
    dataset_path = tmp_path / "dataset.jsonl"
    dataset_path.write_text("\n".join(json.dumps(item) for item in _dataset(manifest)) + "\n", encoding="utf-8")
    output_dir = tmp_path / "run"
    output_dir.mkdir()
    sentinel = output_dir / "keep.txt"
    sentinel.write_text("prior run", encoding="utf-8")

    with pytest.raises(FileExistsError, match="not empty"):
        run_benchmark(
            "experiments/configs/baseline-rag.json",
            dataset_path,
            tmp_path / "manifest.json",
            output_dir,
            backend=TinyBackend(),
        )

    assert sentinel.read_text(encoding="utf-8") == "prior run"


def test_manifest_records_observed_provider_and_model_attempts(tmp_path):
    output_dir = tmp_path / "run"
    output_dir.mkdir()
    manifest_path = tmp_path / "corpus.json"
    manifest_path.write_text("{}", encoding="utf-8")
    (output_dir / "run-manifest.json").write_text("{}", encoding="utf-8")
    (output_dir / "predictions-input.jsonl").write_text(
        json.dumps(
            {
                "id": "q1",
                "llm_attempts": [
                    {"provider": "gemini", "model": "gemini-test", "succeeded": False},
                    {"provider": "openrouter", "model": "openai/test", "succeeded": True},
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )

    _augment_manifest(output_dir, manifest_path, paper_mode=False)
    result = json.loads((output_dir / "run-manifest.json").read_text(encoding="utf-8"))

    assert result["llm_provider_attempts"] == {"gemini": 1, "openrouter": 1}
    assert result["llm_model_attempts"] == {"gemini-test": 1, "openai/test": 1}
    assert result["llm_failed_attempts"] == 1


def test_in_memory_retrieval_respects_query_document_scope():
    retriever = InMemoryRetriever(
        [
            {"chunk_id": "doc-a:chunk-1", "text": "alpha evidence", "metadata": {"document_id": "doc-a"}},
            {"chunk_id": "doc-b:chunk-1", "text": "alpha other evidence", "metadata": {"document_id": "doc-b"}},
        ],
        lambda texts: [[1.0, 0.0] for _ in texts],
    )

    results = retriever.search(
        "alpha evidence", 5, rerank=False, candidate_k=5, document_ids={"doc-a"}
    )

    assert [item["chunk_id"] for item in results] == ["doc-a:chunk-1"]
