"""Export human-review packets with exact corpus passages and provenance."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def split_words(text: str, start: int, count: int) -> str:
    return " ".join(text.split()[start : start + count])


def source_title(text: str, path: Path) -> str:
    match = re.search(r"^#{1,2}\s+(.+?)\s*$", text, flags=re.MULTILINE)
    return match.group(1) if match else path.stem


def _supporting_fact_passages(source_row: dict[str, Any]) -> list[dict[str, Any]]:
    facts = source_row.get("supporting_facts") or {}
    titles = facts.get("title", [])
    indices = facts.get("sent_id", [])
    context = source_row.get("context") or {}
    context_titles = context.get("title", [])
    sentences = context.get("sentences", [])
    output = []
    for title, index in zip(titles, indices):
        try:
            context_index = context_titles.index(title)
            passage = sentences[context_index][index]
        except (ValueError, IndexError, TypeError):
            passage = None
        output.append({"source_title": title, "sentence_index": index, "text": passage})
    return output


def build_packets(dataset_path: Path, manifest_path: Path, source_path: Path, source_rows_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    records = [json.loads(line) for line in dataset_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    manifest = load_json(manifest_path)
    sources = load_json(source_path)
    source_rows = load_json(source_rows_path)["rows"]
    source_rows_by_id = {str(row.get("id")): row for row in source_rows}

    doc_index: dict[str, dict[str, Any]] = {}
    evidence_index: dict[str, dict[str, Any]] = {}
    for source in manifest.get("sources", []):
        path = Path(source["path"])
        text = path.read_text(encoding="utf-8")
        doc_index[source["document_id"]] = {
            "path": source["path"],
            "title": source_title(text, path),
            "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            "text": text,
        }
        words = text.split()
        for chunk in source.get("chunks", []):
            chunk_text = split_words(text, chunk["start_word"], chunk["word_count"])
            chunk_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()
            evidence_index[chunk["evidence_id"]] = {
                "evidence_id": chunk["evidence_id"],
                "document_id": source["document_id"],
                "source_document_name": path.name,
                "source_title": doc_index[source["document_id"]]["title"],
                "source_path": source["path"],
                "page_or_section": None,
                "text": chunk_text,
                "sha256_expected": chunk["text_sha256"],
                "sha256_actual": chunk_hash,
                "hash_valid": chunk_hash == chunk["text_sha256"],
            }

    packets = []
    missing_ids: list[dict[str, str]] = []
    invalid_hashes: list[dict[str, str]] = []
    for record in records:
        evidence = []
        for evidence_id in record.get("gold_evidence_ids", []):
            found = evidence_index.get(evidence_id)
            if found is None:
                missing_ids.append({"record_id": record["id"], "evidence_id": evidence_id})
            else:
                evidence.append(found)
                if not found["hash_valid"]:
                    invalid_hashes.append({"record_id": record["id"], "evidence_id": evidence_id})

        document_ids = [doc["document_id"] for doc in record.get("documents", [])]
        scoped_docs = [doc_index[doc_id] for doc_id in document_ids if doc_id in doc_index]
        synthetic_docs = [doc for doc in scoped_docs if "synthetic" in Path(doc["path"]).stem]
        source_row = source_rows_by_id.get(str((record.get("source_dataset") or {}).get("record_id")))
        absent_support = []
        if record["answer_type"] == "unanswerable" and source_row:
            absent_support = _supporting_fact_passages(source_row)

        challenge_passages = []
        if record["answer_type"] in {"conflicting", "prompt_injection"}:
            for doc in synthetic_docs:
                challenge_passages.append({
                    "source_document_name": Path(doc["path"]).name,
                    "source_title": doc["title"],
                    "source_path": doc["path"],
                    "text": doc["text"],
                    "is_synthetic_untrusted_challenge": True,
                })

        packets.append({
            "id": record["id"],
            "question": record["question"],
            "answer_type": record["answer_type"],
            "gold_answer": record["gold_answer"],
            "gold_evidence_ids": record["gold_evidence_ids"],
            "gold_evidence_passages": evidence,
            "challenge_passages": challenge_passages,
            "unanswerable_explanation": (
                "The candidate intervention removes the annotated supporting facts from the query-scoped corpus. "
                "The passages below are from the source HotpotQA row and are shown as excluded reference material; "
                "they are not available to the benchmark query. Human review must confirm the removal and that no "
                "remaining scoped passage independently answers the question."
                if record["answer_type"] == "unanswerable" else None
            ),
            "excluded_original_supporting_passages": absent_support,
            "source_documents": [
                {
                    "document_id": doc_id,
                    "source_document_name": Path(doc_index[doc_id]["path"]).name,
                    "source_title": doc_index[doc_id]["title"],
                    "source_path": doc_index[doc_id]["path"],
                    "page_or_section": None,
                    "is_synthetic": "synthetic" in Path(doc_index[doc_id]["path"]).stem,
                }
                for doc_id in document_ids if doc_id in doc_index
            ],
            "review": record["review"],
            "automated_support_status": "needs-human-semantic-review",
        })

    id_counts = Counter(record.get("id") for record in records)
    categories = Counter(record.get("answer_type") for record in records)
    report = {
        "dataset_version": "trustrag-v1",
        "source_candidate": str(dataset_path),
        "record_count": len(records),
        "unique_id_count": len(id_counts),
        "duplicate_ids": sorted(record_id for record_id, count in id_counts.items() if count > 1),
        "category_counts": dict(sorted(categories.items())),
        "review_status_counts": dict(sorted(Counter((record.get("review") or {}).get("reviewer_a", "missing") for record in records).items())),
        "missing_evidence_references": missing_ids,
        "invalid_evidence_chunk_hashes": invalid_hashes,
        "semantic_support_verdict": "Not automatically established; every record remains subject to human review.",
        "source_document_pages": "The corpus snapshots contain article sections but no page numbers; section headings are included.",
    }
    return packets, report


def markdown_packet(packet: dict[str, Any]) -> str:
    lines = [
        f"## {packet['id']} — {packet['answer_type']}",
        "",
        f"**Question:** {packet['question']}",
        f"**Gold answer:** {packet['gold_answer'] or '(empty; review expected for this label)'}",
        f"**Gold evidence IDs:** {', '.join(packet['gold_evidence_ids']) or '(none)'}",
        f"**Review:** {json.dumps(packet['review'], ensure_ascii=False)} — not approved by this export.",
        "",
        "### Gold evidence passages (verbatim corpus chunks)",
    ]
    if not packet["gold_evidence_passages"]:
        lines.append("No gold evidence passage is annotated for this record.")
    for passage in packet["gold_evidence_passages"]:
        lines.extend([
            f"**{passage['evidence_id']}** — {passage['source_document_name']} / {passage['source_title']} (page unavailable)",
            f"SHA-256 manifest match: {passage['hash_valid']}",
            "",
            "> " + passage["text"].replace("\n", "\n> "),
            "",
        ])
    if packet["unanswerable_explanation"]:
        lines.extend(["### Why labeled unanswerable", packet["unanswerable_explanation"], "", "#### Excluded original supporting passages (not in query scope)"])
        for passage in packet["excluded_original_supporting_passages"]:
            lines.append(f"- {passage['source_title']} sentence {passage['sentence_index']}: {passage['text']!r}")
    if packet["challenge_passages"]:
        heading = "### Synthetic conflicting side" if packet["answer_type"] == "conflicting" else "### Untrusted prompt-injection passage"
        lines.extend([heading, "These challenge passages are shown separately and are not gold evidence."])
        for passage in packet["challenge_passages"]:
            lines.extend([f"**{passage['source_document_name']} / {passage['source_title']}**", "", "> " + passage["text"].replace("\n", "\n> "), ""])
    lines.extend(["**Automated verdict:** Human semantic review required; no approval recorded.", ""])
    return "\n".join(lines)


def export_review_package(root: Path, output_dir: Path, batch_size: int = 25) -> dict[str, Any]:
    data_dir = root / "experiments/datasets/trustrag-public-candidate-v4"
    packets, report = build_packets(
        data_dir / "trustrag-project-draft.jsonl",
        data_dir / "trustrag-v1.manifest.json",
        data_dir / "corpus-sources.json",
        root / "experiments/datasets/hotpot-validation-sampled-200.source.json",
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(packets), batch_size):
        batch_number = start // batch_size + 1
        batch = packets[start : start + batch_size]
        base = output_dir / f"evidence-review-batch-{batch_number:02d}"
        base.with_suffix(".json").write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        markdown = [f"# TrustRAG evidence review — batch {batch_number:02d}\n", "Source quotations are exact corpus chunks; excluded supporting passages are labeled separately. Pages are unavailable in the snapshots.\n"]
        markdown.extend(markdown_packet(packet) for packet in batch)
        base.with_suffix(".md").write_text("\n".join(markdown), encoding="utf-8")
    report["batch_size"] = batch_size
    report["batch_count"] = (len(packets) + batch_size - 1) // batch_size
    report_path = output_dir / "validation-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, default=Path("experiments/reports/evidence-review-v4"))
    args = parser.parse_args()
    report = export_review_package(args.root.resolve(), (args.root / args.output).resolve())
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
