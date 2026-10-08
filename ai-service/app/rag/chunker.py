import os
import re
from typing import List, Dict, Any

def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 100,
    doc_metadata: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    words = text.split(' ')

    chunks = []
    step = chunk_size - chunk_overlap
    if step <= 0:
        step = chunk_size // 2

    for i in range(0, len(words), step):
        chunk_words = words[i : i + chunk_size]
        if not chunk_words:
            break
        chunk_text_content = ' '.join(chunk_words)
        chunk_id = f"chunk_{len(chunks)+1}_{i}"
        
        meta = {**(doc_metadata or {})}
        meta["chunk_index"] = len(chunks)
        meta["char_length"] = len(chunk_text_content)

        chunks.append({
            "chunk_id": chunk_id,
            "text": chunk_text_content,
            "metadata": meta
        })
        if i + chunk_size >= len(words):
            break

    return chunks

def _is_valid_text(text: str) -> bool:
    """Return True only if the extracted text looks like real readable content."""
    if not text or len(text.strip()) < 50:
        return False
    # xref/binary data contains many '00000 n' tokens
    garbage_ratio = text.count("00000 n") / max(len(text.split()), 1)
    if garbage_ratio > 0.05:
        return False
    printable = sum(1 for c in text if c.isprintable() or c in '\n\r\t')
    return (printable / len(text)) > 0.85


def extract_pdf_pages_from_file(file_path: str) -> List[str]:
    """Extract readable PDF text while preserving its original page boundaries."""

    # Strategy 1: pdfplumber — best for complex layouts and compressed streams
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
        text = "\n".join(pages)
        if _is_valid_text(text):
            return pages
    except ImportError:
        pass
    except Exception:
        pass

    # Strategy 2: pymupdf (fitz) — handles encoded/FlateDecode streams well
    try:
        import fitz
        doc = fitz.open(file_path)
        pages = [page.get_text() for page in doc]
        doc.close()
        text = "\n".join(pages)
        if _is_valid_text(text):
            return pages
    except Exception:
        pass

    # Strategy 3: pypdf — fast fallback for simple PDFs
    try:
        import pypdf
        reader = pypdf.PdfReader(file_path)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages)
        if _is_valid_text(text):
            return pages
    except Exception:
        pass

    raise ValueError(
        "Could not extract readable text from this PDF. "
        "It may be a scanned/image-only PDF. Please upload a text-based PDF."
    )


def _extract_pdf_text(file_path: str) -> str:
    """Compatibility wrapper for callers that need flattened PDF text."""
    return "\n".join(
        page for page in extract_pdf_pages_from_file(file_path) if page.strip()
    )


def chunk_pdf_pages(
    pages: List[str],
    chunk_size: int = 500,
    chunk_overlap: int = 100,
    doc_metadata: Dict[str, Any] = None,
) -> List[Dict[str, Any]]:
    """Chunk each PDF page independently and attach its 1-based page number."""
    chunks: List[Dict[str, Any]] = []
    for page_number, page_text in enumerate(pages, start=1):
        if not page_text or not page_text.strip():
            continue
        page_chunks = chunk_text(
            page_text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            doc_metadata=doc_metadata,
        )
        for page_chunk in page_chunks:
            index = len(chunks)
            metadata = page_chunk["metadata"]
            metadata["page"] = page_number
            metadata["chunk_index"] = index
            page_chunk["chunk_id"] = f"chunk_{index + 1}_page_{page_number}"
            chunks.append(page_chunk)
    return chunks


def extract_text_from_file(file_path: str, mime_type: str = "") -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Uploaded document is not available: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()

    if ext in ['.txt', '.md', '.csv', '.json']:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception:
            return ""

    if ext == '.pdf':
        return _extract_pdf_text(file_path)

    if ext == '.docx':
        try:
            from docx import Document
            document = Document(file_path)
            return "\n".join(p.text for p in document.paragraphs if p.text.strip())
        except Exception as exc:
            raise ValueError(f"Unable to extract DOCX text: {exc}") from exc

    raise ValueError(f"Unsupported document type: {ext or mime_type}")
