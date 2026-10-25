"""Deterministic, secret-free corpus manifests for research runs."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
from typing import Any, Iterable


CHUNK_SIZE = 400
CHUNK_OVERLAP = 80
_SECRET_PATTERNS = (
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"sk-or-v1-[0-9A-Za-z]+"),
    re.compile(r"tvly-[0-9A-Za-z_-]+"),
    re.compile(r"mongodb(?:\+srv)?://[^\s:@/]+:[^\s@]+@", re.IGNORECASE),
)


def _assert_secret_free(text: str, path: Path) -> None:
    if any(pattern.search(text) for pattern in _SECRET_PATTERNS):
        raise ValueError(f"secret-like value detected in corpus source {path}")


def _document_id(path: Path, snapshot_sha256: str) -> str:
    stem = re.sub(r"[^a-z0-9]+", "-", path.stem.casefold()).strip("-") or "document"
    return f"doc-{stem}-{snapshot_sha256[:12]}"


def _relative_path(path: Path) -> str:
    project_root = Path(__file__).resolve().parents[1]
    try:
        return path.resolve().relative_to(project_root).as_posix()
    except ValueError:
        return path.name


def _chunks(text: str, document_id: str) -> list[dict[str, Any]]:
    words = re.sub(r"\s+", " ", text).strip().split(" ")
    if not words or words == [""]:
        return []
    step = CHUNK_SIZE - CHUNK_OVERLAP
    result: list[dict[str, Any]] = []
    for start in range(0, len(words), step):
        chunk_words = words[start : start + CHUNK_SIZE]
        if not chunk_words:
            break
        chunk_key = f"chunk_{len(result) + 1}_{start}"
        chunk_text = " ".join(chunk_words)
        result.append(
            {
                "evidence_id": f"{document_id}:{chunk_key}",
                "chunk_index": len(result),
                "start_word": start,
                "word_count": len(chunk_words),
                "text_sha256": hashlib.sha256(chunk_text.encode("utf-8")).hexdigest(),
            }
        )
    return result


def build_corpus_manifest(
    source_paths: Iterable[str | Path], output_path: str | Path, dataset_version: str
) -> dict[str, Any]:
    paths = sorted({Path(path) for path in source_paths}, key=lambda item: item.as_posix())
    if not paths:
        raise ValueError("at least one corpus source is required")

    sources: list[dict[str, Any]] = []
    for path in paths:
        if not path.is_file():
            raise FileNotFoundError(path)
        raw = path.read_bytes()
        text = raw.decode("utf-8")
        _assert_secret_free(text, path)
        snapshot_sha256 = hashlib.sha256(raw).hexdigest()
        document_id = _document_id(path, snapshot_sha256)
        sources.append(
            {
                "document_id": document_id,
                "path": _relative_path(path),
                "snapshot_sha256": snapshot_sha256,
                "word_count": len(re.sub(r"\s+", " ", text).strip().split(" ")),
                "chunks": _chunks(text, document_id),
            }
        )

    manifest = {
        "manifest_version": "trustrag-corpus-v1",
        "dataset_version": dataset_version,
        "chunking": {"chunk_size": CHUNK_SIZE, "chunk_overlap": CHUNK_OVERLAP},
        "sources": sources,
    }
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def load_corpus_manifest(path: str | Path) -> dict[str, Any]:
    manifest = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("sources"), list):
        raise ValueError("corpus manifest must contain a sources list")
    return manifest


def manifest_documents(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(source["document_id"]): source
        for source in manifest.get("sources", [])
        if isinstance(source, dict) and source.get("document_id")
    }


def manifest_evidence_ids(manifest: dict[str, Any]) -> set[str]:
    evidence_ids: set[str] = set()
    for source in manifest.get("sources", []):
        for chunk in source.get("chunks", []):
            if chunk.get("evidence_id"):
                evidence_ids.add(str(chunk["evidence_id"]))
    return evidence_ids


def load_corpus_rows(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    """Load source text into retrieval rows while checking snapshot hashes."""
    project_root = Path(__file__).resolve().parents[1]
    rows: list[dict[str, Any]] = []
    for source in manifest.get("sources", []):
        source_path = Path(str(source["path"]))
        if not source_path.is_absolute():
            source_path = project_root / source_path
        raw = source_path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != source.get("snapshot_sha256"):
            raise ValueError(f"corpus source changed after manifest creation: {source_path}")
        text = raw.decode("utf-8")
        for chunk in _chunks(text, str(source["document_id"])):
            chunk_text = ""
            words = re.sub(r"\s+", " ", text).strip().split(" ")
            start = int(chunk["start_word"])
            count = int(chunk["word_count"])
            chunk_text = " ".join(words[start : start + count])
            rows.append(
                {
                    "chunk_id": chunk["evidence_id"],
                    "text": chunk_text,
                    "metadata": {
                        "document_id": source["document_id"],
                        "document_name": source["path"],
                        "chunk_index": chunk["chunk_index"],
                    },
                }
            )
    return rows
