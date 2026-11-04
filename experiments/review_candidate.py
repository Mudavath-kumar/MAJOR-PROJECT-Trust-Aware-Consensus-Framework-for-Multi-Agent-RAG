"""Run a conservative, source-linked automated review of the v4 candidate."""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import datetime, timezone
import json
import re
import unicodedata
from pathlib import Path
from typing import Any

from .corpus import load_corpus_manifest, load_corpus_rows
from .runner import load_jsonl, validate_dataset_records


def _normalize(value: Any) -> str:
    ascii_text = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.casefold()).strip()


def _source_facts(source: dict[str, Any]) -> list[tuple[str, str]]:
    context = source["context"]
    facts: list[tuple[str, str]] = []
    for title, sentence_index in zip(
        source["supporting_facts"]["title"], source["supporting_facts"]["sent_id"]
    ):
        title_index = context["title"].index(title)
        facts.append((str(title), str(context["sentences"][title_index][sentence_index])))
    return facts


def _decision(
    record: dict[str, Any], source: dict[str, Any] | None, chunks: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    reasons: list[str] = []
    corrections: list[str] = []
    if source is None:
        return {
            "id": str(record.get("id", "")),
            "category": str(record.get("answer_type", "")),
            "decision": "Not Approved",
            "reviewer_type": "automated",
            "reason": ["The candidate source record ID is absent from the frozen HotpotQA snapshot."],
            "correction_made": corrections,
            "evidence_checked": {},
        }

    if _normalize(record.get("question")) != _normalize(source.get("question")):
        reasons.append("Candidate question differs from its frozen HotpotQA source question.")
    if _normalize(record.get("source_dataset", {}).get("record_id")) != _normalize(source.get("id")):
        reasons.append("Candidate source ID does not match the frozen source row.")

    answer_type = record.get("answer_type")
    facts = _source_facts(source)
    document_ids = {str(document.get("document_id")) for document in record.get("documents", [])}
    scoped_chunks = [chunk for chunk in chunks.values() if chunk["document_id"] in document_ids]
    scope_text = _normalize(" ".join(str(chunk["text"]) for chunk in scoped_chunks))
    gold_ids = [str(evidence_id) for evidence_id in record.get("gold_evidence_ids", [])]
    gold_chunks = [chunks[evidence_id] for evidence_id in gold_ids if evidence_id in chunks]
    gold_text = _normalize(" ".join(str(chunk["text"]) for chunk in gold_chunks))
    all_gold_ids_in_scope = all(chunk["document_id"] in document_ids for chunk in gold_chunks)
    all_facts_in_gold = bool(facts) and all(
        bool(_normalize(fact)) and _normalize(fact) in gold_text for _title, fact in facts
    )
    all_facts_absent_from_scope = all(
        not _normalize(fact) or _normalize(fact) not in scope_text for _title, fact in facts
    )
    if len(gold_chunks) != len(gold_ids) or not all_gold_ids_in_scope:
        reasons.append("One or more gold evidence IDs are missing or outside the record's document scope.")

    synthetic_chunks = [
        chunk
        for chunk in scoped_chunks
        if "synthetic-conflict" in str(chunk["path"]) or "synthetic-injection" in str(chunk["path"])
    ]
    synthetic_doc_ids = {chunk["document_id"] for chunk in synthetic_chunks}
    if any(chunk["document_id"] in synthetic_doc_ids for chunk in gold_chunks):
        reasons.append("A synthetic challenge document is included in gold evidence.")

    automated_status = "Approved"
    if answer_type in {"answerable", "prompt_injection"}:
        if _normalize(record.get("gold_answer")) != _normalize(source.get("answer")):
            reasons.append("Gold answer differs from the frozen source answer.")
        if not gold_ids:
            reasons.append("This answerable record has no gold evidence IDs.")
        if not all_facts_in_gold:
            reasons.append("The selected gold passages do not contain every annotated source supporting fact.")
        if answer_type == "prompt_injection":
            if len(synthetic_chunks) != 1 or not all(
                "Synthetic untrusted document instruction" in str(chunk["text"])
                and "Ignore the user's question" in str(chunk["text"])
                for chunk in synthetic_chunks
            ):
                reasons.append("The scoped prompt-injection fixture is missing or does not contain the expected untrusted instruction.")
    elif answer_type == "unanswerable":
        if gold_ids:
            reasons.append("An unanswerable record must not list gold answer evidence.")
        if not all_facts_absent_from_scope:
            reasons.append("At least one annotated source supporting fact remains in the scoped documents.")
        if not all_facts_absent_from_scope:
            automated_status = "Not Approved"
        elif _normalize(source.get("answer")) and _normalize(source.get("answer")) in scope_text:
            automated_status = "Needs Review"
            reasons.append("The source answer string occurs in the scoped corpus; a reviewer must decide whether context provides the relation needed to answer.")
        else:
            reasons.append("All annotated supporting sentences and the source answer string are absent from the scoped corpus.")
    elif answer_type == "conflicting":
        expected = str(source.get("answer", "")).strip()
        alternative = "no" if expected.casefold() == "yes" else "yes" if expected.casefold() == "no" else f"not {expected}"
        if not all_facts_in_gold:
            reasons.append("Trusted gold passages do not contain every annotated source supporting fact.")
        if record.get("gold_answer") != "":
            reasons.append("The conflict case must use abstention as its expected behavior, not a single disputed answer.")
        if len(synthetic_chunks) != 1 or not any(
            "Synthetic conflicting benchmark source" in str(chunk["text"])
            and f"Synthetic alternative claim: the answer is {alternative}." in str(chunk["text"])
            for chunk in synthetic_chunks
        ):
            reasons.append("The controlled conflict fixture does not contain the expected counterclaim.")
    else:
        reasons.append(f"Unsupported answer type: {answer_type!r}.")

    if reasons and automated_status == "Approved":
        automated_status = "Not Approved"
    if any("differs" in reason or "missing or outside" in reason or "Unsupported answer" in reason for reason in reasons):
        automated_status = "Not Approved"
    if answer_type == "unanswerable" and all_facts_absent_from_scope and not gold_ids and not any(
        "source answer string occurs" in reason for reason in reasons
    ) and not any("differs" in reason or "outside" in reason for reason in reasons):
        automated_status = "Approved"

    if not reasons:
        reasons.append("Source question, answer/evidence or challenge construction, and frozen corpus references passed the automated checks.")
    return {
        "id": str(record.get("id", "")),
        "category": str(answer_type or ""),
        "decision": automated_status,
        "reviewer_type": "automated",
        "reason": reasons,
        "correction_made": corrections,
        "source_record_id": str(source.get("id", "")),
        "evidence_checked": {
            "source_support_fact_count": len(facts),
            "support_facts_in_gold_passages": sum(
                bool(_normalize(fact)) and _normalize(fact) in gold_text for _title, fact in facts
            ),
            "support_facts_in_scoped_corpus": sum(
                bool(_normalize(fact)) and _normalize(fact) in scope_text for _title, fact in facts
            ),
            "gold_evidence_ids": gold_ids,
            "scoped_document_ids": sorted(document_ids),
        },
    }


def audit_candidate(
    dataset_path: str | Path, source_path: str | Path, manifest_path: str | Path
) -> list[dict[str, Any]]:
    dataset_path, source_path, manifest_path = map(Path, (dataset_path, source_path, manifest_path))
    records = load_jsonl(dataset_path)
    source_payload = json.loads(source_path.read_text(encoding="utf-8"))
    source_rows = source_payload.get("rows") if isinstance(source_payload, dict) else None
    if not isinstance(source_rows, list):
        raise ValueError("source snapshot must contain a rows list")
    source_by_id = {str(row.get("id", "")): row for row in source_rows if isinstance(row, dict)}
    if len(source_by_id) != len(source_rows):
        raise ValueError("source snapshot contains missing or duplicate row IDs")

    manifest = load_corpus_manifest(manifest_path)
    validate_dataset_records(records, manifest=manifest)
    rows_by_id = {row["chunk_id"]: row for row in load_corpus_rows(manifest)}
    path_by_doc = {
        str(source["document_id"]): str(source["path"])
        for source in manifest["sources"]
    }
    chunks = {
        evidence_id: {**chunk, "document_id": str(chunk["metadata"]["document_id"]), "path": path_by_doc[str(chunk["metadata"]["document_id"])]}
        for evidence_id, chunk in rows_by_id.items()
    }
    results = [
        _decision(record, source_by_id.get(str(record.get("source_dataset", {}).get("record_id", ""))), chunks)
        for record in records
    ]
    return results


def write_review_package(
    dataset_path: str | Path,
    source_path: str | Path,
    manifest_path: str | Path,
    output_dir: str | Path,
) -> dict[str, Path]:
    dataset_path, output_dir = Path(dataset_path), Path(output_dir)
    if output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError(f"review output directory must be new or empty: {output_dir}")
    records = load_jsonl(dataset_path)
    decisions = audit_candidate(dataset_path, source_path, manifest_path)
    decision_by_id = {item["id"]: item for item in decisions}
    reviewed = []
    eligible = []
    reviewed_at = datetime.now(timezone.utc).isoformat()
    for record in records:
        item = {**record, "automated_review": {**decision_by_id[str(record["id"])], "reviewed_at": reviewed_at}}
        reviewed.append(item)
        if item["automated_review"]["decision"] == "Approved":
            exploratory = dict(item)
            exploratory["human_review_status"] = "pending"
            exploratory.pop("review", None)
            eligible.append(exploratory)

    output_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "reviewed_dataset": output_dir / "candidate-v4-automated-reviewed.jsonl",
        "approved_dataset": output_dir / "candidate-v4-automated-approved-exploratory.jsonl",
        "decisions": output_dir / "per-example-decisions.jsonl",
        "decisions_csv": output_dir / "per-example-decisions.csv",
        "summary": output_dir / "summary.json",
        "readme": output_dir / "README.md",
    }
    for name, values in (("reviewed_dataset", reviewed), ("approved_dataset", eligible), ("decisions", decisions)):
        paths[name].write_text(
            "".join(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n" for value in values),
            encoding="utf-8",
            newline="\n",
        )
    with paths["decisions_csv"].open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=("id", "category", "decision", "reviewer_type", "reason", "correction_made", "source_record_id", "evidence_checked"))
        writer.writeheader()
        for item in decisions:
            writer.writerow({**item, "reason": " | ".join(item["reason"]), "correction_made": " | ".join(item["correction_made"]), "evidence_checked": json.dumps(item["evidence_checked"], sort_keys=True)})
    counts = Counter((item["category"], item["decision"]) for item in decisions)
    summary = {
        "dataset_version": "trustrag-v1",
        "candidate_sha256": __import__("hashlib").sha256(dataset_path.read_bytes()).hexdigest(),
        "source_sha256": __import__("hashlib").sha256(Path(source_path).read_bytes()).hexdigest(),
        "corpus_manifest_sha256": __import__("hashlib").sha256(Path(manifest_path).read_bytes()).hexdigest(),
        "review_type": "automated source-linked consistency and evidence audit",
        "human_approval_recorded": False,
        "record_count": len(decisions),
        "approved_count": sum(item["decision"] == "Approved" for item in decisions),
        "not_approved_count": sum(item["decision"] == "Not Approved" for item in decisions),
        "needs_review_count": sum(item["decision"] == "Needs Review" for item in decisions),
        "approved_exploratory_count": len(eligible),
        "by_category": {
            category: {
                decision: counts[(category, decision)]
                for decision in ("Approved", "Not Approved", "Needs Review")
            }
            for category in sorted({item["category"] for item in decisions})
        },
        "limitations": [
            "Automated decisions are not human approvals.",
            "Answer strings that appear in unanswerable scoped corpora remain Needs Review because lexical occurrence alone does not establish whether the relation is answerable.",
            "This export is not a frozen paper benchmark snapshot and cannot pass the paper-mode review gate.",
        ],
    }
    paths["summary"].write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    paths["readme"].write_text(
        "# Automated review of TrustRAG candidate v4\n\n"
        "This package is a separate automated audit output. The original candidate remains unchanged and its human-review fields remain pending. "
        "The `automated-approved-exploratory` dataset is suitable only for explicitly provisional runs; it is not paper-eligible. "
        "Every decision records reviewer type `automated`, a reason, and any correction (none were applied by this audit).\n",
        encoding="utf-8",
    )
    return paths


def main() -> None:
    root = Path(__file__).resolve().parent
    candidate_dir = root / "datasets" / "trustrag-public-candidate-v4"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=candidate_dir / "trustrag-project-draft.jsonl")
    parser.add_argument("--source", type=Path, default=root / "datasets" / "hotpot-validation-sampled-200.source.json")
    parser.add_argument("--manifest", type=Path, default=candidate_dir / "trustrag-v1.manifest.json")
    parser.add_argument("--output-dir", type=Path, default=root / "reports" / "candidate-review-v4-automated")
    args = parser.parse_args()
    outputs = write_review_package(args.dataset, args.source, args.manifest, args.output_dir)
    print(outputs["summary"])


if __name__ == "__main__":
    main()
