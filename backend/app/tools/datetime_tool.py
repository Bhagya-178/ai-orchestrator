from datetime import datetime

from app.tools.base_tool import BaseTool


class DateTimeTool(BaseTool):
    """
    Tool for retrieving the current date and time.
    """

    name = "datetime"
    description = "Returns the current date and time."

    async def execute(self, **kwargs) -> dict:
        """
        Get the current date and/or time.

        Optional:
            format = "date"
            format = "time"
            format = "datetime" (default)
        """

        output_format = kwargs.get("format", "datetime").lower()

        now = datetime.now()

        if output_format == "date":
            return {
                "success": True,
                "tool": self.name,
                "result": now.strftime("%Y-%m-%d"),
            }

        elif output_format == "time":
            return {
                "success": True,
                "tool": self.name,
                "result": now.strftime("%H:%M:%S"),
            }

        elif output_format == "datetime":
            return {
                "success": True,
                "tool": self.name,
                "result": now.strftime("%Y-%m-%d %H:%M:%S"),
            }

        return {
            "success": False,
            "tool": self.name,
            "error": f"Unsupported format: {output_format}",
        }