"""
Web Scraper and Content Extractor Tool.
Fetches public web pages, strips scripts/styles/ads, and extracts clean markdown
for downstream analysis and agent context.
"""

import re
import html
from typing import Any
import httpx
from app.tools.base_tool import BaseTool


def _html_to_clean_markdown(html_text: str, max_chars: int = 4000) -> str:
    """Convert raw HTML into readable markdown text."""
    # Remove script and style tags
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html_text, flags=re.IGNORECASE)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<noscript[^>]*>[\s\S]*?</noscript>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<!--[\s\S]*?-->", "", text)

    # Convert headers
    text = re.sub(r"<h1[^>]*>(.*?)</h1>", r"\n# \1\n", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<h2[^>]*>(.*?)</h2>", r"\n## \1\n", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<h3[^>]*>(.*?)</h3>", r"\n### \1\n", text, flags=re.IGNORECASE | re.DOTALL)

    # Convert paragraphs and breaks
    text = re.sub(r"<p[^>]*>(.*?)</p>", r"\n\1\n", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)

    # Convert list items
    text = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", text, flags=re.IGNORECASE | re.DOTALL)

    # Convert links
    text = re.sub(r'<a\s+[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>', r"[\2](\1)", text, flags=re.IGNORECASE | re.DOTALL)

    # Strip remaining HTML tags
    text = re.sub(r"<[^>]+>", " ", text)

    # Unescape HTML entities
    text = html.unescape(text)

    # Collapse repeated whitespace and blank lines
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    text = text.strip()

    if len(text) > max_chars:
        text = text[:max_chars] + f"\n\n... [Content truncated at {max_chars} characters]"

    return text


class WebScraperTool(BaseTool):
    name = "web_scraper"
    description = (
        "Fetch public web page content from a given URL and extract clean, readable text/markdown. "
        "Useful for reading documentation, articles, or web pages discovered via search."
    )
    risk_level = "safe"
    timeout_seconds = 15.0
    parameters_schema = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "Full HTTP or HTTPS URL of the web page to scrape.",
            },
            "max_length": {
                "type": "integer",
                "description": "Maximum character length of extracted markdown (default 4000).",
            },
        },
        "required": ["url"],
    }

    async def execute(self, **kwargs) -> dict[str, Any]:
        url = kwargs.get("url", "").strip()
        max_length = min(int(kwargs.get("max_length", 4000)), 12000)

        if not url.startswith(("http://", "https://")):
            return {"error": "Invalid URL protocol. Must start with http:// or https://"}

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36 AI-Orchestrator/2.0"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)

                if response.status_code != 200:
                    return {
                        "url": url,
                        "status_code": response.status_code,
                        "error": f"HTTP request failed with status code {response.status_code}",
                    }

                content_type = response.headers.get("content-type", "")
                if "text/html" not in content_type and "text/plain" not in content_type:
                    return {
                        "url": url,
                        "content_type": content_type,
                        "error": f"Unsupported content-type '{content_type}'. Only HTML/plain text are supported.",
                    }

                markdown = _html_to_clean_markdown(response.text, max_chars=max_length)

                return {
                    "url": url,
                    "status_code": response.status_code,
                    "content_length": len(markdown),
                    "markdown": markdown,
                }

        except httpx.TimeoutException:
            return {"url": url, "error": "Request timed out after 12 seconds."}
        except Exception as ex:
            return {"url": url, "error": f"Failed scraping page: {str(ex)}"}
