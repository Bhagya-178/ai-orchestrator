import asyncio
import logging
import re
from pathlib import Path

try:
    import pymupdf  # type: ignore[import-untyped, import-not-found]
except ImportError:
    try:
        import fitz as pymupdf  # type: ignore[import-untyped, import-not-found]
    except ImportError:
        pymupdf = None  # type: ignore[assignment]

try:
    from docx import Document as DocxDocument  # type: ignore[import-untyped, import-not-found]
except ImportError:
    DocxDocument = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# -- Configurable defaults -------------------------------------------------
# TOKEN-BASED CHUNKING (not character-based)
# Approximate: 1 token ≈ 4 characters for English text
DEFAULT_CHUNK_SIZE_TOKENS = 512  # ~2048 characters; good for 8K context windows
DEFAULT_CHUNK_OVERLAP_TOKENS = 64  # ~256 characters of overlap between chunks

# Helper: Convert between tokens and characters
CHARS_PER_TOKEN = 4  # Rough approximation for English


def estimate_tokens(text: str) -> int:
    """Estimate token count using character approximation."""
    return len(text) // CHARS_PER_TOKEN


def estimate_chars_for_tokens(tokens: int) -> int:
    """Convert token count to approximate character count."""
    return tokens * CHARS_PER_TOKEN


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences using a regex heuristic."""
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p for p in parts if p.strip()]


def chunk_text(
    text: str,
    chunk_size_tokens: int = DEFAULT_CHUNK_SIZE_TOKENS,
    overlap_tokens: int = DEFAULT_CHUNK_OVERLAP_TOKENS,
) -> list[str]:
    """Split text into overlapping chunks, preferring sentence boundaries.

    Uses TOKEN-BASED sizing (not character-based) for better LLM performance.
    Greedily packs whole sentences up to chunk_size_tokens (~2KB per chunk).
    Falls back to character-level splitting only when a single
    sentence exceeds chunk_size_tokens.
    
    Args:
        text: Input text to chunk
        chunk_size_tokens: Target chunk size in tokens (~2048 chars for 512 tokens)
        overlap_tokens: Overlap between chunks in tokens (~256 chars for 64 tokens)
        
    Returns:
        List of text chunks.
    """
    chunk_size_chars = estimate_chars_for_tokens(chunk_size_tokens)
    overlap_chars = estimate_chars_for_tokens(overlap_tokens)
    
    sentences = _split_sentences(text)
    if not sentences:
        return [text] if text.strip() else []

    chunks: list[str] = []
    current_sentences: list[str] = []
    current_len = 0

    for sentence in sentences:
        sentence_len = len(sentence)

        # Oversized single sentence → hard-split by characters.
        if sentence_len > chunk_size_chars:
            if current_sentences:
                chunks.append(" ".join(current_sentences))
                current_sentences = []
                current_len = 0

            start = 0
            while start < sentence_len:
                end = min(start + chunk_size_chars, sentence_len)
                chunks.append(sentence[start:end])
                start += chunk_size_chars - overlap_chars
            continue

        # Would adding this sentence exceed the budget?
        if current_len + sentence_len + (1 if current_sentences else 0) > chunk_size_chars:
            chunks.append(" ".join(current_sentences))

            # Carry tail sentences as overlap context.
            overlap_sentences: list[str] = []
            overlap_len = 0
            for s in reversed(current_sentences):
                if overlap_len + len(s) + (1 if overlap_sentences else 0) > overlap_chars:
                    break
                overlap_sentences.insert(0, s)
                overlap_len += len(s) + (1 if len(overlap_sentences) > 1 else 0)

            current_sentences = overlap_sentences
            current_len = (
                sum(len(s) for s in current_sentences)
                + max(0, len(current_sentences) - 1)
            )

        current_sentences.append(sentence)
        current_len += sentence_len + (1 if len(current_sentences) > 1 else 0)

    if current_sentences:
        chunks.append(" ".join(current_sentences))

    return chunks


def _sync_parse_pdf(file_path: str) -> list[dict]:
    """Extract text from PDF with page numbers (sync)."""
    chunks = []
    doc = pymupdf.open(file_path)
    try:
        for page_num, page in enumerate(doc, 1):
            text = page.get_text().strip()
            if text:
                chunks.append({
                    "content": text,
                    "page_num": page_num,
                    "metadata": {"source": "pdf", "page": page_num},
                })
    finally:
        doc.close()
    return chunks


async def parse_pdf(file_path: str) -> list[dict]:
    """Extract text from PDF with page numbers."""
    return await asyncio.to_thread(_sync_parse_pdf, file_path)


def _sync_parse_docx(file_path: str) -> list[dict]:
    """Extract text from DOCX with section-level granularity (sync).
    
    Extracts text from paragraphs, tables, and headers.
    Falls back to PyMuPDF if python-docx fails or extracts nothing.
    """
    chunks: list[dict] = []
    target_chars = estimate_chars_for_tokens(DEFAULT_CHUNK_SIZE_TOKENS)

    # Strategy 1: python-docx (paragraphs + tables + headers)
    try:
        doc = DocxDocument(file_path)
        section_paragraphs: list[str] = []
        section_char_count = 0
        section_num = 1

        # Extract all paragraphs
        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue

            section_paragraphs.append(text)
            section_char_count += len(text)

            if section_char_count >= target_chars:
                chunks.append({
                    "content": "\n".join(section_paragraphs),
                    "page_num": section_num,
                    "metadata": {"source": "docx", "section": section_num},
                })
                section_paragraphs = []
                section_char_count = 0
                section_num += 1

        # Extract all tables (e.g. data tables, form fields, tabular questions)
        for table in doc.tables:
            for row in table.rows:
                cells_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                # Deduplicate identical adjacent cells caused by cell merges
                unique_cells: list[str] = []
                for c in cells_text:
                    if not unique_cells or c != unique_cells[-1]:
                        unique_cells.append(c)
                if unique_cells:
                    row_text = " | ".join(unique_cells)
                    section_paragraphs.append(row_text)
                    section_char_count += len(row_text)
                    if section_char_count >= target_chars:
                        chunks.append({
                            "content": "\n".join(section_paragraphs),
                            "page_num": section_num,
                            "metadata": {"source": "docx-table", "section": section_num},
                        })
                        section_paragraphs = []
                        section_char_count = 0
                        section_num += 1

        if section_paragraphs:
            chunks.append({
                "content": "\n".join(section_paragraphs),
                "page_num": section_num,
                "metadata": {"source": "docx", "section": section_num},
            })
    except Exception as e:
        logger.warning(f"python-docx parsing failed for {file_path}: {e}")
        chunks = []

    # Strategy 2: PyMuPDF fallback (natively extracts all text from .docx pages)
    if not chunks:
        try:
            doc = pymupdf.open(file_path)
            try:
                for page_num, page in enumerate(doc, 1):
                    text = page.get_text().strip()
                    if text:
                        chunks.append({
                            "content": text,
                            "page_num": page_num,
                            "metadata": {"source": "docx-pymupdf", "page": page_num},
                        })
            finally:
                doc.close()
        except Exception as e:
            logger.warning(f"PyMuPDF docx fallback failed for {file_path}: {e}")

    return chunks


async def parse_docx(file_path: str) -> list[dict]:
    """Extract text from DOCX with section-level granularity."""
    return await asyncio.to_thread(_sync_parse_docx, file_path)


def _sync_parse_doc(file_path: str) -> list[dict]:
    """Extract text from legacy binary Word .doc files."""
    chunks: list[dict] = []

    # 1. Try PyMuPDF
    try:
        doc = pymupdf.open(file_path)
        try:
            for page_num, page in enumerate(doc, 1):
                text = page.get_text().strip()
                if text:
                    chunks.append({
                        "content": text,
                        "page_num": page_num,
                        "metadata": {"source": "doc-pymupdf", "page": page_num},
                    })
        finally:
            doc.close()
    except Exception as e:
        logger.debug(f"PyMuPDF could not read .doc {file_path}: {e}")

    if chunks:
        return chunks

    # 2. Try Windows Word COM automation if available (for native Word .doc on Windows)
    try:
        import os
        import win32com.client
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(os.path.abspath(file_path))
        raw_text = doc.Content.Text
        doc.Close()
        word.Quit()
        if raw_text and raw_text.strip():
            raw_chunks = chunk_text(raw_text.strip())
            for idx, c in enumerate(raw_chunks, 1):
                chunks.append({
                    "content": c,
                    "page_num": idx,
                    "metadata": {"source": "doc-word", "section": idx},
                })
            return chunks
    except Exception as e:
        logger.debug(f"win32com could not read .doc {file_path}: {e}")

    # 3. Fallback: Parse binary stream directly (UTF-16LE / ASCII text blocks from OLE CFB)
    try:
        with open(file_path, "rb") as f:
            data = f.read()

        extracted_lines: list[str] = []
        # Word 97-2003 stores text stream in UTF-16LE
        utf16_matches = re.findall(rb'(?:[\x20-\x7e\r\n\t]\x00){4,}', data)
        for m in utf16_matches:
            try:
                s = m.decode("utf-16le").strip()
                if len(s) > 3 and not s.startswith("Normal") and not s.startswith("Default"):
                    extracted_lines.append(s)
            except Exception:
                pass

        if not extracted_lines:
            ascii_matches = re.findall(rb'[\x20-\x7e\r\n\t]{4,}', data)
            for m in ascii_matches:
                try:
                    s = m.decode("cp1252", errors="ignore").strip()
                    if len(s) > 3 and not s.startswith("Microsoft") and not s.startswith("Word.Document"):
                        extracted_lines.append(s)
                except Exception:
                    pass

        full_doc_text = "\n".join(extracted_lines).strip()
        if full_doc_text:
            text_blocks = chunk_text(full_doc_text)
            for idx, blk in enumerate(text_blocks, 1):
                chunks.append({
                    "content": blk,
                    "page_num": idx,
                    "metadata": {"source": "doc-binary", "section": idx},
                })
    except Exception as e:
        logger.error(f"Binary .doc extraction failed for {file_path}: {e}")

    return chunks


async def parse_doc(file_path: str) -> list[dict]:
    """Extract text from legacy binary Word .doc files."""
    return await asyncio.to_thread(_sync_parse_doc, file_path)


def _sync_parse_text(file_path: str) -> list[dict]:
    """Read plain text, code, or structured data files (sync)."""
    encodings = ["utf-8", "utf-8-sig", "latin1", "cp1252"]
    content = ""
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                content = f.read().strip()
            break
        except Exception:
            continue

    if not content:
        return []

    ext = Path(file_path).suffix.lower()
    # If the file is large, chunk it so embeddings are fine-grained
    if len(content) > 1500:
        chunks = chunk_text(content)
        return [
            {
                "content": c,
                "page_num": idx,
                "metadata": {"source": ext[1:] if ext else "text", "chunk": idx},
            }
            for idx, c in enumerate(chunks, 1)
        ]

    return [{
        "content": content,
        "page_num": 1,
        "metadata": {"source": ext[1:] if ext else "text"},
    }]


async def parse_text(file_path: str) -> list[dict]:
    """Read plain text or code file asynchronously."""
    return await asyncio.to_thread(_sync_parse_text, file_path)


CODE_AND_DATA_EXTENSIONS = frozenset({
    ".txt", ".md", ".py", ".js", ".ts", ".jsx", ".tsx",
    ".json", ".csv", ".sql", ".html", ".css", ".yaml", ".yml",
    ".sh", ".bash", ".xml", ".ini", ".env", ".toml", ".c", ".cpp",
    ".java", ".rs", ".go"
})


async def parse_document(file_path: str, content_type: str) -> list[dict]:
    """Parse document and return list of {content, page_num, metadata} dicts."""
    ext = Path(file_path).suffix.lower()
    
    if ext == ".pdf":
        return await parse_pdf(file_path)
    elif ext == ".docx":
        return await parse_docx(file_path)
    elif ext == ".doc":
        return await parse_doc(file_path)
    elif ext in CODE_AND_DATA_EXTENSIONS:
        return await parse_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
