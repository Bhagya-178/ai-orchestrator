"""
Sandboxed File System Tool.
Enables agents to safely inspect directories, view file statistics, and read project files
strictly restricted within the project root to prevent path traversal vulnerabilities.
"""

import os
import pathlib
import stat
from typing import Any
from app.tools.base_tool import BaseTool


class FileSystemTool(BaseTool):
    name = "file_system"
    description = (
        "Inspect directories, check file stats, or read file contents safely within the project workspace. "
        "Actions: 'list_dir', 'read_file', 'file_stats', 'find_files'."
    )
    risk_level = "safe"
    timeout_seconds = 10.0
    parameters_schema = {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_dir", "read_file", "file_stats", "find_files"],
                "description": "File system action to perform.",
            },
            "path": {
                "type": "string",
                "description": "Relative path to target file or directory within workspace.",
            },
            "pattern": {
                "type": "string",
                "description": "Glob pattern for 'find_files' action (e.g. '*.py', '**/*.tsx').",
            },
            "max_lines": {
                "type": "integer",
                "description": "Maximum lines to read for 'read_file' (default 200).",
            },
        },
        "required": ["action"],
    }

    def __init__(self, workspace_root: str | None = None):
        self.workspace_root = pathlib.Path(workspace_root or os.getcwd()).resolve()

    def _resolve_safe(self, user_path: str | None) -> pathlib.Path:
        """Resolve path and verify it remains strictly within workspace root."""
        if user_path and ("\x00" in user_path or "%00" in user_path):
            raise ValueError("Null byte injection detected in path.")
        clean_path = (user_path or ".").strip().lstrip("/\\")
        target = (self.workspace_root / clean_path).resolve()
        if not str(target).startswith(str(self.workspace_root)):
            raise PermissionError(f"Access denied: path '{user_path}' escapes the workspace boundary.")
        return target

    async def execute(self, **kwargs) -> dict[str, Any]:
        action = kwargs.get("action")
        raw_path = kwargs.get("path", ".")

        try:
            target = self._resolve_safe(raw_path)

            if action == "list_dir":
                if not target.exists():
                    return {"error": f"Directory not found: {raw_path}"}
                if not target.is_dir():
                    return {"error": f"Path is not a directory: {raw_path}"}

                items = []
                for entry in sorted(target.iterdir()):
                    # Ignore git and node_modules
                    if entry.name.startswith(".") or entry.name in ("node_modules", "__pycache__", "venv"):
                        continue
                    items.append({
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size_bytes": entry.stat().st_size if entry.is_file() else None,
                    })
                return {"path": raw_path, "total_items": len(items), "items": items[:100]}

            elif action == "read_file":
                if not target.exists() or not target.is_file():
                    return {"error": f"File not found: {raw_path}"}

                max_lines = kwargs.get("max_lines", 200)
                try:
                    with open(target, "r", encoding="utf-8", errors="replace") as f:
                        lines = [f.readline() for _ in range(max_lines)]
                        has_more = bool(f.readline())
                    return {
                        "path": raw_path,
                        "lines_read": len(lines),
                        "truncated": has_more,
                        "content": "".join(lines),
                    }
                except Exception as ex:
                    return {"error": f"Failed reading file: {str(ex)}"}

            elif action == "file_stats":
                if not target.exists():
                    return {"error": f"Path not found: {raw_path}"}
                st = target.stat()
                return {
                    "path": raw_path,
                    "is_file": target.is_file(),
                    "size_bytes": st.st_size,
                    "modified_timestamp": st.st_mtime,
                    "permissions": oct(stat.S_IMODE(st.st_mode)),
                }

            elif action == "find_files":
                pattern = kwargs.get("pattern", "*")
                matches = []
                for p in target.glob(pattern):
                    if len(matches) >= 50:
                        break
                    # Skip hidden/system
                    if any(part.startswith(".") or part in ("node_modules", "__pycache__", "venv") for part in p.parts):
                        continue
                    matches.append(str(p.relative_to(self.workspace_root)))
                return {"pattern": pattern, "match_count": len(matches), "matches": matches}

            else:
                return {"error": f"Unknown file_system action: {action}"}

        except Exception as err:
            return {"error": str(err)}
