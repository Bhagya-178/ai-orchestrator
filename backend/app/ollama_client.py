import httpx

from app.config import OLLAMA_URL, OLLAMA_KEEP_ALIVE


class OllamaClient:

    def __init__(self):
        self.timeout = httpx.Timeout(
            connect=10.0,
            read=300.0,
            write=30.0,
            pool=30.0,
        )

    async def generate(
        self,
        model: str,
        prompt: str,
        options: dict | None = None,
    ) -> dict:

        payload = {
            "model": model,
            "prompt": prompt.strip(),
            "stream": False,
            "keep_alive": OLLAMA_KEEP_ALIVE,
        }

        if options:
            payload["options"] = options

        async with httpx.AsyncClient(timeout=self.timeout) as client:

            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json=payload,
            )

        response.raise_for_status()

        return response.json()

    async def chat(
        self,
        model: str,
        messages: list,
        options: dict | None = None,
    ) -> dict:

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "keep_alive": OLLAMA_KEEP_ALIVE,
        }

        if options:
            payload["options"] = options

        async with httpx.AsyncClient(timeout=self.timeout) as client:

            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload,
            )

        response.raise_for_status()

        return response.json()

    async def stream_chat(
        self,
        model: str,
        messages: list,
        options: dict | None = None,
    ):

        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "keep_alive": OLLAMA_KEEP_ALIVE,
        }

        if options:
            payload["options"] = options

        async with httpx.AsyncClient(timeout=None) as client:

            async with client.stream(
                "POST",
                f"{OLLAMA_URL}/api/chat",
                json=payload,
            ) as response:

                response.raise_for_status()

                async for line in response.aiter_lines():

                    if line:
                        yield line

    async def health(self) -> bool:

        async with httpx.AsyncClient(timeout=10.0) as client:

            response = await client.get(
                f"{OLLAMA_URL}/api/tags"
            )

        response.raise_for_status()

        return response.status_code == 200

    async def list_models(self) -> list[str]:

        async with httpx.AsyncClient(timeout=10.0) as client:

            response = await client.get(
                f"{OLLAMA_URL}/api/tags"
            )

        response.raise_for_status()

        data = response.json()

        return [
            model["name"]
            for model in data.get("models", [])
        ]
        
    async def unload_model(self, model: str) -> None:

         payload = {
        "model": model,
        "prompt": "",
        "keep_alive": 0,
    }
 
         async with httpx.AsyncClient(timeout=self.timeout) as client:

            response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
        )

            response.raise_for_status()


ollama = OllamaClient()