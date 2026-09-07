"""
Safe Read-Only SQL Query Tool.
Enables agents to query database schema and analytical tables safely with read-only
SELECT enforcement, query execution timeouts, and strict row capping.
"""

import re
import time
from typing import Any
from sqlalchemy import text
from app.database.database import get_session_factory
from app.tools.base_tool import BaseTool


FORBIDDEN_SQL_PATTERNS = [
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE)\b",
    r"\b(EXEC|EXECUTE|VACUUM|REINDEX)\b",
    r";",  # Prevent stacked query injection
]


class SQLQueryTool(BaseTool):
    name = "sql_query"
    description = (
        "Execute a safe read-only SQL SELECT query against the database to inspect tables, "
        "schemas, or query records. Only SELECT queries are permitted; data modification is blocked."
    )
    risk_level = "moderate"
    timeout_seconds = 15.0
    parameters_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The read-only SQL SELECT statement to execute.",
            },
            "max_rows": {
                "type": "integer",
                "description": "Maximum number of rows to return (default 25, max 100).",
            },
        },
        "required": ["query"],
    }

    def _validate_sql(self, query: str) -> None:
        """Verify query is strictly read-only SELECT."""
        clean = query.strip()
        if not re.match(r"^SELECT\b", clean, re.IGNORECASE):
            raise ValueError("Only queries starting with SELECT are allowed.")

        for pattern in FORBIDDEN_SQL_PATTERNS:
            # Skip the leading SELECT check
            if re.search(pattern, clean, re.IGNORECASE):
                if pattern != r";" and re.search(r"^\s*SELECT\b", pattern, re.IGNORECASE):
                    continue
                match = re.search(pattern, clean, re.IGNORECASE)
                if match:
                    raise ValueError(f"Forbidden SQL keyword or delimiter detected: '{match.group(0)}'")

    async def execute(self, **kwargs) -> dict[str, Any]:
        query = kwargs.get("query", "").strip()
        max_rows = min(int(kwargs.get("max_rows", 25)), 100)

        try:
            self._validate_sql(query)
            session_factory = get_session_factory()
            start_time = time.perf_counter()

            async with session_factory() as session:
                # Add LIMIT if not already present
                if not re.search(r"\bLIMIT\s+\d+\b", query, re.IGNORECASE):
                    executed_query = f"{query} LIMIT {max_rows}"
                else:
                    executed_query = query

                result = await session.execute(text(executed_query))
                columns = list(result.keys())
                rows = result.fetchmany(max_rows)
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

                formatted_rows = []
                for row in rows:
                    row_dict = {}
                    for col, val in zip(columns, row):
                        row_dict[col] = str(val) if val is not None else None
                    formatted_rows.append(row_dict)

                return {
                    "columns": columns,
                    "row_count": len(formatted_rows),
                    "rows": formatted_rows,
                    "elapsed_ms": elapsed_ms,
                    "executed_query": executed_query,
                }

        except Exception as err:
            return {
                "error": str(err),
                "query": query,
            }
