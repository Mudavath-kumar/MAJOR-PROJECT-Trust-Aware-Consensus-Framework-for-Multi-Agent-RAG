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
        try:
            # Try pypdf if installed
            import pypdf
            reader = pypdf.PdfReader(file_path)
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages)
        except Exception as exc:
            raise ValueError(f"Unable to extract PDF text: {exc}") from exc

    if ext == '.docx':
        try:
            from docx import Document
            document = Document(file_path)
            return "\n".join(p.text for p in document.paragraphs if p.text.strip())
        except Exception as exc:
            raise ValueError(f"Unable to extract DOCX text: {exc}") from exc

    raise ValueError(f"Unsupported document type: {ext or mime_type}")
