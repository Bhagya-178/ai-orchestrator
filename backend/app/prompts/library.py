"""
Curated Catalog of Production Prompt Templates.
"""

from typing import Any
from datetime import datetime, timezone
import uuid

from app.prompts.parser import extract_template_variables


DEFAULT_PROMPT_TEMPLATES = [
    {
        "id": "tpl_code_architect",
        "title": "Software Systems Architect",
        "category": "Coding",
        "description": "Designs robust distributed software architectures, design patterns, and interface contracts.",
        "system_prompt": (
            "You are a Principal Software Architect. You evaluate trade-offs between scalability, "
            "maintainability, and latency. Always output architecture diagrams using Mermaid where helpful."
        ),
        "user_template": (
            "Design a software architecture for {{system_name}}.\n"
            "Requirements:\n{{requirements}}\n"
            "Constraints:\n- Primary Language/Stack: {{tech_stack|Python and TypeScript}}\n"
            "- Target Latency: {{target_latency|p99 < 150ms}}\n"
            "- Scale: {{expected_scale|100k DAU}}"
        ),
        "tags": ["architecture", "systems", "scalability"],
        "version": "1.0.0",
        "is_public": True,
    },
    {
        "id": "tpl_security_auditor",
        "title": "Cybersecurity & Code Auditor",
        "category": "Security",
        "description": "Thoroughly inspects code for OWASP Top 10 vulnerabilities, race conditions, and cryptographic weaknesses.",
        "system_prompt": (
            "You are a Lead Application Security Engineer. You perform static application security testing (SAST) "
            "identifying SQL injection, XSS, SSRF, broken access controls, and deserialization hazards. "
            "Highlight severity ratings (Critical, High, Medium, Low) and provide remediated code snippets."
        ),
        "user_template": (
            "Please perform a security audit on the following code snippet:\n\n"
            "Language: {{language|Python}}\n"
            "Code:\n```{{language|python}}\n{{source_code}}\n```\n\n"
            "Focus specifically on {{focus_area|injection and authorization bypass}}."
        ),
        "tags": ["security", "audit", "owasp"],
        "version": "1.2.0",
        "is_public": True,
    },
    {
        "id": "tpl_data_analyst",
        "title": "Statistical Data Analyst",
        "category": "Data Science",
        "description": "Formulates analytical hypotheses, computes statistical metrics, and synthesizes executive insights.",
        "system_prompt": (
            "You are a Staff Data Scientist. You extract insights from tabular metrics, explain standard deviations, "
            "correlations, and suggest visualizations (Bar charts, Scatter plots, Box plots)."
        ),
        "user_template": (
            "Analyze the dataset described below:\n"
            "Context: {{business_context}}\n"
            "Metrics Table / Columns:\n{{dataset_columns}}\n"
            "Key Question to Answer: {{target_question}}"
        ),
        "tags": ["data", "analytics", "statistics"],
        "version": "1.0.0",
        "is_public": True,
    },
    {
        "id": "tpl_ts_refactor",
        "title": "TypeScript & React Modernizer",
        "category": "Coding",
        "description": "Refactors legacy JavaScript / React code into strict, performant TypeScript with idiomatic hooks.",
        "system_prompt": (
            "You are a TypeScript and React Core Specialist. You convert untyped code into strictly typed TypeScript, "
            "eliminating 'any', using discriminated unions, and optimizing render performance."
        ),
        "user_template": (
            "Refactor the following React component to modern TypeScript:\n\n"
            "```tsx\n{{react_code}}\n```\n\n"
            "Requirements:\n"
            "- Add explicit prop and state interfaces\n"
            "- Optimize with useCallback / useMemo if needed\n"
            "- Explain key improvements made"
        ),
        "tags": ["typescript", "react", "frontend"],
        "version": "1.0.0",
        "is_public": True,
    },
    {
        "id": "tpl_executive_brief",
        "title": "Executive Summary & Briefing",
        "category": "Writing",
        "description": "Condenses lengthy technical or financial reports into high-impact C-level executive summaries.",
        "system_prompt": (
            "You are a Senior Strategic Advisor. You write concise executive briefs highlighting TL;DR, "
            "strategic implications, quantifiable risks, and immediate action recommendations."
        ),
        "user_template": (
            "Draft an executive briefing based on the following document:\n\n"
            "Title: {{document_title}}\n"
            "Audience: {{target_audience|Executive Leadership}}\n"
            "Full Text / Notes:\n{{source_notes}}\n\n"
            "Format: 1-paragraph TL;DR followed by 3-5 bulleted strategic takeaways and next steps."
        ),
        "tags": ["summary", "executive", "writing"],
        "version": "1.1.0",
        "is_public": True,
    },
]


class PromptLibraryManager:
    """Manages prompt template catalog, custom user templates, and variables."""

    def __init__(self):
        self._templates: dict[str, dict[str, Any]] = {}
        for tpl in DEFAULT_PROMPT_TEMPLATES:
            item = dict(tpl)
            item["variables"] = extract_template_variables(item["user_template"])
            item["created_at"] = datetime.now(timezone.utc).isoformat()
            self._templates[item["id"]] = item

    def list_templates(self, category: str | None = None, search: str | None = None) -> list[dict[str, Any]]:
        results = list(self._templates.values())
        if category:
            results = [r for r in results if r.get("category", "").lower() == category.lower()]
        if search:
            q = search.lower()
            results = [
                r for r in results
                if q in r.get("title", "").lower() or q in r.get("description", "").lower() or any(q in t for t in r.get("tags", []))
            ]
        return results

    def get_template(self, template_id: str) -> dict[str, Any] | None:
        return self._templates.get(template_id)

    def create_template(self, data: dict[str, Any], author_id: str) -> dict[str, Any]:
        tid = f"custom_{uuid.uuid4().hex[:8]}"
        user_template = data.get("user_template", "")
        item = {
            "id": tid,
            "title": data.get("title", "Untitled Template"),
            "category": data.get("category", "General"),
            "description": data.get("description", ""),
            "system_prompt": data.get("system_prompt", ""),
            "user_template": user_template,
            "variables": extract_template_variables(user_template),
            "tags": data.get("tags", []),
            "version": "1.0.0",
            "is_public": bool(data.get("is_public", False)),
            "author_id": author_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._templates[tid] = item
        return item

    def delete_template(self, template_id: str, author_id: str) -> bool:
        tpl = self._templates.get(template_id)
        if not tpl or tpl.get("author_id") != author_id:
            return False
        del self._templates[template_id]
        return True


prompt_library = PromptLibraryManager()
