"""
Python Code Runner tool.
Executes Python code snippets in an isolated sub-process with timeout limits (like ChatGPT Advanced Data Analysis).
"""

import asyncio
import logging
import sys
from typing import Any

from app.tools.base_tool import BaseTool

logger = logging.getLogger(__name__)


class PythonRunnerTool(BaseTool):
    """
    Executes Python scripts safely in a subprocess and returns stdout, stderr, and execution state.
    """

    name: str = "python_interpreter"
    description: str = "Execute Python code to perform calculations, data analysis, string manipulation, or test algorithms. Input: code (string)."

    async def execute(self, code: str = "", **kwargs: Any) -> dict[str, Any]:
        if not code.strip():
            code = kwargs.get("script") or kwargs.get("command") or ""

        code = str(code).strip()
        if not code:
            return {"error": "No Python code provided to execute."}

        logger.info("Executing Python code snippet (length: %d chars)", len(code))

        try:
            # Run code via python -c in a subprocess with 10-second timeout
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                "-c",
                code,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(),
                    timeout=10.0,
                )
            except asyncio.TimeoutError:
                try:
                    process.kill()
                except Exception:
                    pass
                return {
                    "success": False,
                    "error": "Execution timed out (limit: 10 seconds).",
                    "result": "Execution timed out after 10 seconds.",
                }

            stdout_str = stdout_data.decode("utf-8", errors="replace").strip()
            stderr_str = stderr_data.decode("utf-8", errors="replace").strip()
            exit_code = process.returncode

            output = stdout_str
            if stderr_str:
                output = f"{stdout_str}\nErrors:\n{stderr_str}".strip() if stdout_str else f"Error: {stderr_str}"

            if not output:
                output = f"Code executed successfully (exit code {exit_code}) with no output."

            return {
                "success": exit_code == 0,
                "exit_code": exit_code,
                "stdout": stdout_str,
                "stderr": stderr_str,
                "result": output,
            }

        except Exception as e:
            logger.exception("Failed to execute python code: %s", e)
            return {
                "success": False,
                "error": str(e),
                "result": f"Execution failed: {str(e)}",
            }
