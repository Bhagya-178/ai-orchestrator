"""
Deterministic, rule-based tool detection.

Runs BEFORE the LLM classifier in RequestProcessor so that clear
calculator / datetime requests always route to a tool — even when the
small classifier model (qwen2.5:1.5b) fails to emit needs_tool.

Only high-confidence, anchored patterns live here. Anything uncertain
is left for the LLM to classify.
"""

import re
from typing import Any


class ToolDetector:
    """Pattern-match messages that must trigger a built-in tool."""

    # --- RAG / Document Search Patterns ----------------------------- #
    # High-confidence patterns for document/file search queries
    _RAG_PATTERNS: list[str] = [
        # Direct file/document references with action verbs
        r"\b(?:search|find|look|extract|get|retrieve|read|explain|summarize|show|tell|list|display|what|tell)\b.*\b(?:in|from|inside|within|within|throughout|through)\b.*\b(?:my|the|this)\b.*\b(?:document|file|pdf|upload|paper|article)",
        r"\b(?:in|inside|within|throughout)\b.*\b(?:my|the|this|your)\b.*\b(?:document|file|pdf|upload|paper|article|content)",
        # Specific PDF/file mentions with question
        r"(?:document|file|pdf|upload).*(?:say|contain|explain|have|show|list|include)",
        # "Explain/summarize the X document/file"
        r"(?:explain|summarize|read|extract|find|search|what.*(?:in|from)).*\b(?:document|file|pdf|upload)",
        # Document metadata queries
        r"(?:questions?|content|details?|information|summary|overview).*(?:in|from|inside).*\b(?:document|file|pdf|upload)",
    ]

    _RAG_COMPILED: list[re.Pattern[str]] = [
        re.compile(p, re.IGNORECASE) for p in _RAG_PATTERNS
    ]

    # --- Datetime phrase patterns (anchored so conceptual questions
    # like "explain how time works" never match). ------------------- #
    # Every pattern is end-anchored ($) so only direct "what is the
    # date/time right now" questions match — never "date of the event",
    # "what time should we meet", "time in Paris", etc. Cover both word
    # orders ("today's date" and "the date today") because both are
    # common, and the small classifier LLM misroutes the latter.
    _DATETIME_PATTERNS: dict[str, list[str]] = {
        "datetime": [
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?(?:current\s+)?"
            r"date\s+(?:and|&)\s+time\s*\??\s*$",
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?(?:current\s+)?"
            r"time\s+(?:and|&)\s+date\s*\??\s*$",
            r"\b(?:current\s+)?date\s+and\s+time\s*\??\s*$",
        ],
        "time": [
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?(?:current\s+)?"
            r"time\s+is\s+it\s+(?:right\s+)?now\s*\??\s*$",
            r"\bwhat\s+time\s+is\s+it\s*\??\s*$",
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?(?:current\s+)?"
            r"time\s*\??\s*$",
            r"\btime\s+(?:right\s+)?now\s*\??\s*$",
            r"\btell\s+me\s+(?:the\s+)?(?:current\s+)?time\s*\??\s*$",
            r"\bcurrent\s+time\s*\??\s*$",
        ],
        "date": [
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?(?:current\s+|today'?s\s+)?"
            r"date\s*(?:today)?\s*\??\s*$",
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?date\s+is\s+it\s*\??\s*$",
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?date\s+is\s+it\s+today\s*\??\s*$",
            r"\bwhat\s+day\s+is\s+it\s*\??\s*$",
            r"\bwhat\s+day\s+is\s+it\s+today\s*\??\s*$",
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?today\s*\??\s*$",
            r"\btoday'?s\s+date\s*\??\s*$",
            r"\bdate\s+today\s*\??\s*$",
            r"\bcurrent\s+date\s*\??\s*$",
        ],
        "year": [
            r"\bwhat\s+(?:year\s+is\s+it|is\s+(?:the\s+)?(?:current\s+)?year)\s*\??\s*$",
            r"\bwhat\s+(?:is\s+|'s\s+|s\s+)?(?:the\s+)?(?:current\s+)?year\s*\??\s*$",
            r"\bcurrent\s+year\s*\??\s*$",
        ],
    }

    _COMPILED: dict[str, list[re.Pattern[str]]] = {
        kind: [re.compile(p, re.IGNORECASE) for p in patterns]
        for kind, patterns in _DATETIME_PATTERNS.items()
    }

    # --- Calculator ------------------------------------------------- #
    _MATH_PREFIX = re.compile(
        r"^\s*(?:what\s+(?:is\s+|'s\s+|s\s+)|whats\s+|calculate\s+"
        r"|compute\s+|solve\s+|evaluate\s+)",
        re.IGNORECASE,
    )

    _PERCENT_OF = re.compile(
        r"(?P<num>\d+(?:\.\d+)?)\s*(?:%|percent)\s*of\s+(?P<total>\d+(?:\.\d+)?)",
        re.IGNORECASE,
    )

    _PURE_MATH = re.compile(r"[0-9+\-*/().%\s]+")

    def detect(self, message: str) -> dict[str, Any] | None:
        """Return a tool override dict, or None if no tool is clearly requested."""
        text = (message or "").strip()
        if not text:
            return None

        # Expand "what's"/"whats" -> "what is" so contraction forms match
        # the same patterns as their expanded forms. Word-boundary-anchored
        # so "whatsapp" is never affected.
        text = re.sub(r"\bwhat'?s\b", "what is", text, flags=re.IGNORECASE)

        datetime_hit = self._detect_datetime(text)
        if datetime_hit:
            return datetime_hit

        calculator_hit = self._detect_calculator(text)
        if calculator_hit:
            return calculator_hit

        return None

    def detect_rag(self, message: str) -> bool:
        """Return True if the message clearly asks to search/query uploaded documents."""
        text = (message or "").strip().lower()
        if not text:
            return False

        # Check if any RAG pattern matches
        for pattern in self._RAG_COMPILED:
            if pattern.search(text):
                return True

        return False

    # ------------------------------------------------------------------
    def _detect_datetime(self, text: str) -> dict[str, Any] | None:
        for kind in ("datetime", "time", "date", "year"):
            for pattern in self._COMPILED[kind]:
                if pattern.search(text):
                    return {
                        "needs_tool": True,
                        "tool_name": "datetime",
                        "tool_args": {"format": kind},
                        "intent": "general",
                        "task_type": "conversation",
                    }
        return None

    def _detect_calculator(self, text: str) -> dict[str, Any] | None:
        # Strip the "what is / calculate / solve" prefix FIRST so percent
        # phrases like "what is 15% of 200" match, not just the bare form.
        candidate = self._MATH_PREFIX.sub("", text).strip().rstrip("?.").rstrip()

        # "15% of 200" / "15 percent of 200" -> "200 * 0.15"
        percent = self._PERCENT_OF.fullmatch(candidate)
        if percent:
            num = float(percent.group("num"))
            total = percent.group("total")
            return self._calc_result(f"{total} * {num / 100}")

        if not candidate:
            return None

        # Must be a pure arithmetic expression (digits + operators only).
        if not self._PURE_MATH.fullmatch(candidate):
            return None

        if not any(ch.isdigit() for ch in candidate):
            return None

        if not any(op in candidate for op in ("+", "-", "*", "/", "%")):
            return None

        return self._calc_result(candidate)

    def _calc_result(self, expression: str) -> dict[str, Any]:
        return {
            "needs_tool": True,
            "tool_name": "calculator",
            "tool_args": {"expression": expression},
            "intent": "reasoning",
            "task_type": "mathematics",
        }


tool_detector = ToolDetector()
