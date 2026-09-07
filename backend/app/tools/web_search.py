"""
Web search tool using DuckDuckGo HTML / Instant Answer endpoints.
Enables the AI model to browse and synthesize live web information without an API key.
"""

import logging
import re
import urllib.parse
from typing import Any
import httpx

from app.tools.base_tool import BaseTool

logger = logging.getLogger(__name__)


class WebSearchTool(BaseTool):
    """
    Searches the live web using DuckDuckGo and returns synthesized title, snippets, and URLs.
    """

    name: str = "web_search"
    description: str = "Search the internet for current facts, news, documentation, or technical information. Input: query (string)."

    async def execute(self, query: str = "", **kwargs: Any) -> dict[str, Any]:
        if not query.strip():
            # Support alternative argument naming from LLM (e.g., 'q', 'search_query')
            query = kwargs.get("q") or kwargs.get("search_query") or kwargs.get("search") or ""

        query = str(query).strip()
        if not query:
            return {"error": "No search query provided."}

        logger.info("Executing web search for query: %s", query)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

        try:
            encoded_query = urllib.parse.quote_plus(query)
            # Use DuckDuckGo HTML search endpoint (fast, zero API key)
            url = f"https://html.duckduckgo.com/html/?q={encoded_query}"

            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)

            if response.status_code != 200:
                logger.warning("DuckDuckGo returned status %d for query: %s", response.status_code, query)
                return {
                    "query": query,
                    "results": [],
                    "summary": f"Web search service returned status {response.status_code}.",
                }

            html = response.text

            # Parse results from HTML without heavy BeautifulSoup dependency
            # Results are formatted in <div class="result ..."> with class="result__snippet" and class="result__title"
            results = []
            
            # Extract links and titles
            title_matches = re.findall(
                r'<a[^>]+class="result__snippet[^"]*"[^>]*>(.*?)</a>',
                html,
                re.DOTALL | re.IGNORECASE,
            )
            link_matches = re.findall(
                r'<a[^>]+class="result__url[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                html,
                re.DOTALL | re.IGNORECASE,
            )

            # Fallback general block match
            snippet_blocks = re.findall(
                r'<a class="result__snippet[^>]*>(.*?)</a>',
                html,
                re.DOTALL,
            )

            for i, raw_snippet in enumerate(snippet_blocks[:5]):
                clean_snippet = re.sub(r"<[^>]+>", "", raw_snippet).strip()
                clean_snippet = re.sub(r"\s+", " ", clean_snippet)
                if clean_snippet:
                    results.append({
                        "index": i + 1,
                        "snippet": clean_snippet,
                    })

            if not results:
                # Fallback: simple text extraction of first readable section
                body_clean = re.sub(r"<script.*?</script>", "", html, flags=re.DOTALL)
                body_clean = re.sub(r"<style.*?</style>", "", body_clean, flags=re.DOTALL)
                body_clean = re.sub(r"<[^>]+>", " ", body_clean)
                body_clean = re.sub(r"\s+", " ", body_clean).strip()
                words = body_clean[:800]
                results.append({
                    "index": 1,
                    "snippet": words,
                })

            formatted_output = "\n".join(
                f"[{r['index']}] {r['snippet']}" for r in results
            )

            return {
                "query": query,
                "count": len(results),
                "results": results,
                "result": formatted_output,
            }

        except Exception as e:
            logger.exception("Web search execution failed: %s", e)
            return {
                "query": query,
                "error": f"Failed to perform search: {str(e)}",
            }
