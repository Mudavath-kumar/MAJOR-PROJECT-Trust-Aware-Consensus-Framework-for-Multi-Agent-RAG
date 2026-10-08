import sys
from types import SimpleNamespace
from unittest.mock import patch

from app.rag import chunker


def test_pdf_chunks_keep_one_based_source_page_for_each_chunk():
    chunk_pdf_pages = getattr(chunker, "chunk_pdf_pages", None)
    assert callable(chunk_pdf_pages), "PDF ingestion needs a page-aware chunker"

    chunks = chunk_pdf_pages(
        ["alpha beta gamma delta epsilon zeta eta theta", "iota kappa lambda mu"],
        chunk_size=4,
        chunk_overlap=1,
        doc_metadata={"document_id": "doc-1"},
    )

    assert [chunk["metadata"]["page"] for chunk in chunks] == [1, 1, 1, 2]
    assert [chunk["metadata"]["chunk_index"] for chunk in chunks] == [0, 1, 2, 3]
    assert len({chunk["chunk_id"] for chunk in chunks}) == len(chunks)


def test_empty_pdf_pages_do_not_shift_later_source_page_numbers():
    chunk_pdf_pages = getattr(chunker, "chunk_pdf_pages", None)
    assert callable(chunk_pdf_pages), "PDF ingestion needs a page-aware chunker"

    chunks = chunk_pdf_pages(["", "actual content on page two"], chunk_size=10, chunk_overlap=2)

    assert chunks[0]["metadata"]["page"] == 2


def test_non_paginated_text_chunks_do_not_claim_a_pdf_page():
    chunks = chunker.chunk_text("A plain text source has no physical page boundary.")

    assert "page" not in chunks[0]["metadata"]


def test_pdf_extraction_preserves_blank_pages_in_original_page_positions(tmp_path):
    class _Pdf:
        pages = [
            SimpleNamespace(extract_text=lambda: "First page has enough readable content for the extraction validation."),
            SimpleNamespace(extract_text=lambda: ""),
            SimpleNamespace(extract_text=lambda: "Third page has enough readable content to verify original page numbering."),
        ]

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    fake_pdfplumber = SimpleNamespace(open=lambda _path: _Pdf())
    with patch.dict(sys.modules, {"pdfplumber": fake_pdfplumber}):
        pages = chunker.extract_pdf_pages_from_file(str(tmp_path / "fixture.pdf"))

    assert len(pages) == 3
    assert pages[1] == ""
    assert chunker.chunk_pdf_pages(pages)[-1]["metadata"]["page"] == 3
