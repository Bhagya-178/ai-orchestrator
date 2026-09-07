"""
Declarative Data Visualization and Chart Generator Tool.
Accepts tabular or structured series data and returns production Chart.js specifications
ready for instant rendering in UI canvas artifacts or inline cards.
"""

from typing import Any, Literal
from app.tools.base_tool import BaseTool


ChartType = Literal["bar", "line", "pie", "doughnut", "radar", "polarArea"]

DEFAULT_PALETTE = [
    "#3b82f6",  # blue
    "#10b981",  # emerald
    "#f59e0b",  # amber
    "#ef4444",  # rose
    "#8b5cf6",  # purple
    "#06b6d4",  # cyan
    "#ec4899",  # pink
    "#14b8a6",  # teal
]


class ChartGeneratorTool(BaseTool):
    name = "chart_generator"
    description = (
        "Generate a declarative Chart.js specification from structured data. "
        "Supports 'bar', 'line', 'pie', 'doughnut', and 'radar' charts. "
        "Returns a complete config object ready for frontend rendering."
    )
    risk_level = "safe"
    timeout_seconds = 5.0
    parameters_schema = {
        "type": "object",
        "properties": {
            "chart_type": {
                "type": "string",
                "enum": ["bar", "line", "pie", "doughnut", "radar"],
                "description": "The type of chart to generate.",
            },
            "title": {
                "type": "string",
                "description": "Descriptive title for the chart.",
            },
            "labels": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Category labels along the X axis or slices (e.g. ['Q1', 'Q2', 'Q3', 'Q4']).",
            },
            "datasets": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "data": {"type": "array", "items": {"type": "number"}},
                    },
                    "required": ["label", "data"],
                },
                "description": "List of series data points to plot.",
            },
        },
        "required": ["chart_type", "labels", "datasets"],
    }

    async def execute(self, **kwargs) -> dict[str, Any]:
        chart_type = kwargs.get("chart_type", "bar")
        title = kwargs.get("title", "Generated Chart")
        labels = kwargs.get("labels", [])
        raw_datasets = kwargs.get("datasets", [])

        if not labels:
            return {"error": "Labels array cannot be empty."}
        if not raw_datasets:
            return {"error": "Datasets array cannot be empty."}

        formatted_datasets = []
        is_circular = chart_type in ("pie", "doughnut", "polarArea")

        for idx, ds in enumerate(raw_datasets):
            color = DEFAULT_PALETTE[idx % len(DEFAULT_PALETTE)]
            formatted_ds: dict[str, Any] = {
                "label": ds.get("label", f"Series {idx + 1}"),
                "data": ds.get("data", []),
            }

            if is_circular:
                # Give each slice a distinct color
                formatted_ds["backgroundColor"] = [
                    DEFAULT_PALETTE[i % len(DEFAULT_PALETTE)] for i in range(len(labels))
                ]
            else:
                formatted_ds["backgroundColor"] = f"{color}CC"
                formatted_ds["borderColor"] = color
                formatted_ds["borderWidth"] = 2
                if chart_type == "line":
                    formatted_ds["fill"] = False
                    formatted_ds["tension"] = 0.3

            formatted_datasets.append(formatted_ds)

        chart_config = {
            "type": chart_type,
            "data": {
                "labels": labels,
                "datasets": formatted_datasets,
            },
            "options": {
                "responsive": True,
                "maintainAspectRatio": False,
                "plugins": {
                    "title": {
                        "display": bool(title),
                        "text": title,
                        "font": {"size": 16, "weight": "bold"},
                    },
                    "legend": {
                        "display": True,
                        "position": "top",
                    },
                },
            },
        }

        return {
            "title": title,
            "chart_type": chart_type,
            "spec": chart_config,
            "html_embed": f"""<div style="width:100%;height:350px;"><canvas id="chart"></canvas></div><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>new Chart(document.getElementById('chart'), {chart_config});</script>""",
        }
