"""
Prompt Template Variable Extraction and Substitution Engine.
Supports Mustache-style `{{variable}}` syntax, default fallbacks `{{variable|default}}`,
and runtime validation.
"""

import re
from typing import Any


VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)(?:\s*\|\s*([^}]+))?\s*\}\}")


def extract_template_variables(template_str: str) -> list[dict[str, Any]]:
    """
    Scan a template string and extract all variable placeholders.
    Returns list of {"name": str, "default": str | None, "required": bool}.
    """
    seen = set()
    variables = []

    for match in VARIABLE_PATTERN.finditer(template_str):
        var_name = match.group(1)
        default_val = match.group(2)
        if var_name not in seen:
            seen.add(var_name)
            variables.append({
                "name": var_name,
                "default": default_val.strip() if default_val else None,
                "required": default_val is None,
            })

    return variables


def render_template(template_str: str, values: dict[str, Any]) -> str:
    """
    Substitute variables into template string.
    Raises ValueError if a required variable is missing.
    """
    def replacer(match: re.Match) -> str:
        var_name = match.group(1)
        default_val = match.group(2)

        if var_name in values and values[var_name] is not None:
            return str(values[var_name])
        elif default_val is not None:
            return default_val.strip()
        else:
            raise ValueError(f"Missing required prompt template variable: '{var_name}'")

    return VARIABLE_PATTERN.sub(replacer, template_str)
