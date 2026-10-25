import json
from pathlib import Path

import pytest

from experiments.build_public_dataset import build_candidate_dataset, freeze_hotpot_responses
from experiments.build_public_dataset import _document_text
from experiments.corpus import load_corpus_manifest
from experiments.runner import load_jsonl, validate_dataset_records


def _row(record_id: str, *, answer: str = "Alpha", support_title: str = "Alpha page") -> dict:
    return {
        "id": record_id,
        "question": f"Which entity answers {record_id}?",
        "answer": answer,
        "type": "bridge",
        "level": "medium",
        "context": {
            "title": [support_title, "Distractor page"],
            "sentences": [
                [f"{answer} is the supported answer for {record_id}.", "Additional source detail."],
                ["This distractor contains unrelated information."],
            ],
        },
        "supporting_facts": {"title": [support_title], "sent_id": [0]},
    }


def test_public_candidate_builder_creates_review_gated_balanced_records(tmp_path):
    rows = [_row(f"source-{index}") for index in range(4)]
    counts = {
        "answerable": 1,
        "unanswerable": 1,
        "conflicting": 1,
        "prompt_injection": 1,
    }

    dataset_path, manifest_path = build_candidate_dataset(
        rows,
        tmp_path,
        counts=counts,
    )

    manifest = load_corpus_manifest(manifest_path)
    records = load_jsonl(dataset_path)
    validate_dataset_records(records, manifest=manifest, expected_counts=counts)
    assert [record["answer_type"] for record in records] == list(counts)
    assert all(record["review"]["resolution"] == "pending" for record in records)
    assert records[0]["gold_answer"] == "Alpha"
    assert records[0]["gold_evidence_ids"]
    assert records[1]["gold_answer"] == ""
    assert records[1]["gold_evidence_ids"] == []
    assert records[2]["challenge"]["synthetic"] is True
    assert len(records[2]["documents"]) == 2
    assert records[3]["challenge"]["synthetic"] is True
    assert records[3]["gold_answer"] == "Alpha"
    assert records[3]["gold_evidence_ids"]
    assert "ignore the user's question" in " ".join(
        path.read_text(encoding="utf-8").casefold()
        for path in tmp_path.glob("corpus/**/*.md")
    )


def test_public_candidate_builder_rejects_repeated_source_questions(tmp_path):
    row = _row("duplicate")

    with pytest.raises(ValueError, match="unique source IDs"):
        build_candidate_dataset(
            [row, row],
            tmp_path,
            counts={"answerable": 1, "unanswerable": 1},
        )


def test_public_candidate_builder_rejects_invalid_hotpot_supporting_facts(tmp_path):
    row = _row("bad-support")
    row["supporting_facts"]["sent_id"] = [99]

    with pytest.raises(ValueError, match="supporting fact"):
        build_candidate_dataset(
            [row],
            tmp_path,
            counts={"answerable": 1},
        )


def test_evidence_removal_preserves_non_supporting_sentences_in_support_paragraphs():
    row = _row("sentence-removal")

    text = _document_text(row, excluded_facts={("Alpha page", 0)})

    assert "Alpha is the supported answer" not in text
    assert "Additional source detail." in text


def test_conflict_challenge_negates_the_gold_answer_instead_of_using_a_title(tmp_path):
    row = _row("numeric-conflict", answer="1200000 oilbbl/d", support_title="Soyo")
    row["context"]["title"][1] = "Ubangi River"

    dataset_path, _manifest_path = build_candidate_dataset(
        [row],
        tmp_path,
        counts={"conflicting": 1},
    )

    record = load_jsonl(dataset_path)[0]
    document_ids = {document["document_id"] for document in record["documents"]}
    manifest = load_corpus_manifest(tmp_path / "trustrag-v1.manifest.json")
    conflict_source = next(
        source for source in manifest["sources"]
        if source["document_id"] in document_ids and "synthetic-conflict" in source["path"]
    )
    conflict_path = tmp_path / "corpus" / Path(conflict_source["path"]).name
    conflict_text = conflict_path.read_text(encoding="utf-8")

    assert "the answer is not 1200000 oilbbl/d" in conflict_text.casefold()
    assert "the answer is ubangi river" not in conflict_text.casefold()
    synthetic_evidence_ids = {
        chunk["evidence_id"]
        for source in manifest["sources"]
        if "synthetic-conflict" in source["path"]
        for chunk in source["chunks"]
    }
    assert record["gold_evidence_ids"]
    assert not (set(record["gold_evidence_ids"]) & synthetic_evidence_ids)


def test_freeze_records_public_source_license_and_source_response_hashes(tmp_path):
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    first.write_text(
        json.dumps({"num_rows_total": 10, "rows": [{"row_idx": 0, "row": _row("one")}]}),
        encoding="utf-8",
    )
    second.write_text(
        json.dumps({"num_rows_total": 10, "rows": [{"row_idx": 1, "row": _row("two")}]}),
        encoding="utf-8",
    )

    snapshot_path = freeze_hotpot_responses([first, second], tmp_path / "snapshot.json", retrieved_on="2026-10-24")
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))

    assert snapshot["source"]["dataset"] == "HotpotQA"
    assert snapshot["source"]["license"] == "CC BY-SA 4.0"
    assert snapshot["source"]["retrieved_on"] == "2026-10-24"
    assert len(snapshot["source"]["source_responses"]) == 2
    assert len(snapshot["rows"]) == 2


def test_freeze_rejects_overlapping_public_source_ranges(tmp_path):
    response = tmp_path / "response.json"
    response.write_text(
        json.dumps({"num_rows_total": 10, "rows": [{"row_idx": 1, "row": _row("one")}]}),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="ranges overlap"):
        freeze_hotpot_responses(
            [response, response], tmp_path / "snapshot.json", retrieved_on="2026-10-24"
        )


def test_freeze_does_not_overwrite_an_existing_source_snapshot(tmp_path):
    response = tmp_path / "response.json"
    response.write_text(
        json.dumps({"num_rows_total": 10, "rows": [{"row_idx": 1, "row": _row("one")}]}),
        encoding="utf-8",
    )
    snapshot_path = tmp_path / "snapshot.json"
    original = '{"source":"preserve"}\n'
    snapshot_path.write_text(original, encoding="utf-8")

    with pytest.raises(FileExistsError, match="source snapshot already exists"):
        freeze_hotpot_responses([response], snapshot_path, retrieved_on="2026-10-24")

    assert snapshot_path.read_text(encoding="utf-8") == original
