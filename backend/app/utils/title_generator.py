"""
Intelligent conversation title generator.
Extracts short, sweet, and meaningful titles capturing only the core topic / main point.
"""
import re

def extract_short_title(text: str, max_words: int = 5, max_chars: int = 36) -> str:
    """
    Extract a concise, 'short and sweet' title capturing only the main topic/point.
    E.g.
    'Introduction to Internet of Things: IoT Definition...' -> 'Introduction to IoT' or 'Introduction to Internet of Things'
    'what is the difference between TCP and UDP' -> 'Difference between TCP and UDP'
    'Patel_Bhagya_Vaibhav_Summer_Internship_Report_fixed_3.docx summary...' -> 'Summer Internship Report Summary'
    """
    if not text:
        return "New Conversation"

    # Replace newlines/tabs with single spaces and strip
    clean = re.sub(r"[\r\n\t]+", " ", text).strip()
    # Remove markdown headers, bold, italics, backticks, list markers
    clean = re.sub(r"^[#\s\*\-\d\.\>\`]+", "", clean).strip()
    clean = clean.replace("**", "").replace("__", "").replace("`", "")

    # 1. Check for document filenames in prompt (e.g. Patel_Bhagya_Vaibhav_Summer_Internship_Report_fixed_3.docx)
    doc_match = re.search(r"([A-Za-z0-9_\-]+\.(?:docx?|pdf|txt|csv|xlsx|json|py|md|html))", clean, re.IGNORECASE)
    if doc_match:
        fname = doc_match.group(1)
        base = re.sub(r"\.[a-zA-Z0-9]+$", "", fname)
        base = re.sub(r"(_fixed|\bversion|\bv\d+|_v\d+).*", "", base, flags=re.IGNORECASE)
        words = [w for w in re.split(r"[_\-\s]+", base) if w]
        if len(words) > 3:
            title_candidate = " ".join(words[-3:])
        else:
            title_candidate = " ".join(words)
        if any(w in clean.lower() for w in ("summar", "report", "review", "detail")):
            if not title_candidate.lower().endswith("summary") and not title_candidate.lower().endswith("report"):
                title_candidate += " Summary"
        if title_candidate.strip():
            # Clean common abbreviations
            cand = title_candidate.strip().title()
            return cand[:max_chars]

    # 2. Check for colon, dash, semicolon or question mark separating topic from details
    # e.g. 'Introduction to Internet of Things: IoT Definition, ...'
    for sep in (":", " - ", " — ", " | ", ";", "?"):
        if sep in clean:
            prefix = clean.split(sep)[0].strip()
            # If prefix is between 3 and 50 chars and has 1 to 6 words, that is the main topic
            if 3 <= len(prefix) <= 50 and 1 <= len(prefix.split()) <= 7:
                clean = prefix
                break

    # 3. Handle common IoT / Internet of Things alias for brevity
    clean = re.sub(r"\bInternet of Things\b", "IoT", clean, flags=re.IGNORECASE)

    # 4. Strip conversational filler prefixes (only if prompt is longer than 4 words)
    if len(clean.split()) > 4:
        filler_patterns = [
            r"^(?:can you\s+|could you\s+|please\s+|kindly\s+)?(?:explain|tell\s+me\s+about|describe|summarize|give\s+me\s+an?\s+overview\s+of|give\s+me|overview\s+of)\s+(?:to\s+me\s+)?(?:about\s+|how\s+|what\s+|why\s+)?",
            r"^(?:can you\s+|could you\s+|please\s+)?(?:write\s+a\s+python\s+script\s+(?:for|to)|write\s+a\s+script\s+(?:for|to)|write\s+a|write\s+me\s+a|write|code\s+a|create\s+a|build\s+a|generate\s+a)\s+",
            r"^(?:what\s+is\s+the\s+difference\s+between|what\s+is\s+the|what\s+are\s+the|what\s+is|what\s+are|what\s+does|how\s+do\s+i|how\s+to|how\s+does|why\s+is|why\s+does|why)\s+",
            r"^(?:i\s+want\s+to\s+know\s+about|i\s+need\s+help\s+with|help\s+me\s+with|i\s+need\s+to|i\s+want\s+to)\s+",
            r"^(?:now\s+)?(?:improve\s+the|improve|fix\s+the|fix|remove\s+the|remove|update\s+the|update)\s+",
        ]
        for pat in filler_patterns:
            stripped = re.sub(pat, "", clean, flags=re.IGNORECASE).strip()
            if stripped != clean and len(stripped) >= 3:
                clean = stripped
                break

    # 5. Split off secondary explanatory clauses (e.g. '... when response is generated', '... this just gimmick')
    clause_delims = [r"\bwhen\b", r"\bbecause\b", r"\bthis\s+is\b", r"\bthis\s+just\b", r"\bso\s+that\b", r"\bin\s+order\s+to\b", r"\bwhich\s+is\b", r"\.\s+", r",\s+"]
    for delim in clause_delims:
        parts = re.split(delim, clean, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) > 1 and len(parts[0].strip().split()) >= 2:
            clean = parts[0].strip()
            break

    # 5. Split words and keep within limits
    words = clean.split()
    if not words:
        return "New Conversation"

    selected_words = []
    char_len = 0
    for w in words:
        if len(selected_words) >= max_words:
            break
        add_len = len(w) + (1 if selected_words else 0)
        if char_len + add_len > max_chars:
            break
        selected_words.append(w)
        char_len += add_len

    if not selected_words:
        selected_words = [words[0][:max_chars]]

    res = " ".join(selected_words).strip(" ,;:-.?")

    # Title-case nicely if it's all lower or all upper
    if res.islower() or res.isupper():
        res = res.title()
    else:
        # Capitalize first letter
        res = res[0].upper() + res[1:] if len(res) > 1 else res.upper()

    return res or "New Conversation"
