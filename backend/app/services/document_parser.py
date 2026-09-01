import asyncio
import re
from pathlib import Path

import pymupdf
from docx import Document as DocxDocument

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
    """Extract text from DOCX with section-level granularity (sync)."""
    chunks = []
    doc = DocxDocument(file_path)

    section_paragraphs: list[str] = []
    section_char_count = 0
    section_num = 1
    target_chars = estimate_chars_for_tokens(DEFAULT_CHUNK_SIZE_TOKENS)

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

    if section_paragraphs:
        chunks.append({
            "content": "\n".join(section_paragraphs),
            "page_num": section_num,
            "metadata": {"source": "docx", "section": section_num},
        })

    return chunks


async def parse_docx(file_path: str) -> list[dict]:
    """Extract text from DOCX with section-level granularity."""
    return await asyncio.to_thread(_sync_parse_docx, file_path)


def _sync_parse_text(file_path: str) -> list[dict]:
    """Read plain text file (sync)."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read().strip()
    if content:
        return [{
            "content": content,
            "page_num": 1,
            "metadata": {"source": "text"},
        }]
    return []


async def parse_text(file_path: str) -> list[dict]:
    """Read plain text file."""
    return await asyncio.to_thread(_sync_parse_text, file_path)


async def parse_document(file_path: str, content_type: str) -> list[dict]:
    """Parse document and return list of {content, page_num, ...} dicts."""
    ext = Path(file_path).suffix.lower()
    
    if ext == ".pdf":
        return await parse_pdf(file_path)
    elif ext in (".docx", ".doc"):
        return await parse_docx(file_path)
    elif ext in (".txt", ".md"):
        return await parse_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")
