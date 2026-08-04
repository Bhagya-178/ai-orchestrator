# AI Orchestrator Backend

A local AI orchestration backend built with FastAPI and Ollama.

This service processes incoming chat requests, detects intent, decides whether a tool call is needed, routes the request to the best local LLM, maintains session memory, logs performance metrics, and returns structured responses.

## Key Features

- Intent-aware request processing
- Prompt optimization and normalization
- Tool detection and execution
- Model routing based on intent
- Streaming and non-streaming chat responses
- Session memory support
- PostgreSQL request logging
- Local Ollama model integration

## Architecture Overview

1. Incoming request arrives at `/chat` or `/chat/stream`
2. The processor analyzes the message with `qwen2.5:1.5b`
3. If a tool is required, the tool executes directly and returns a result
4. Otherwise, the router selects a model from the registry
5. The selected model receives the user message plus session history
6. The assistant response is returned and stored in memory
7. Request metrics are logged to PostgreSQL

## Supported Models

The model registry currently maps intents to local Ollama models:

- `general` → `qwen3:8b`
- `coding` → `qwen2.5-coder:7b`
- `study` → `gemma4:e4b`
- `reasoning` → `deepseek-r1:8b`
- Processor → `qwen2.5:1.5b`

## Requirements

- Python 3.11+
- PostgreSQL
- Ollama running locally

## Installation

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file in `backend/` or set these variables in your environment:

- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `APP_NAME` - application name (default: `AI Orchestrator`)
- `OLLAMA_KEEP_ALIVE` - Ollama keep-alive setting (default: `10s`)
- `DATABASE_URL` - Async PostgreSQL URL, e.g. `postgresql+asyncpg://user:pass@host:5432/dbname`

## Run Locally

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health

```http
GET /health
```

Response:

- `status`: `running`
- `ollama`: `online` or `offline`

### Root

```http
GET /
```

Response:

- `status`: `running`

### Models

```http
GET /models
```

Returns available Ollama models from the local runtime.

### Chat

```http
POST /chat
```

Request body:

```json
{
  "message": "Hello, what can you do?"
}
```

Response schema:

- `success`
- `session_id`
- `intent`
- `model`
- `latency_ms`
- `response`

### Streaming Chat

```http
POST /chat/stream
```

Returns streamed text chunks from the selected Ollama model.

### Conversation Creation

```http
POST /conversations
```

Returns a new `conversation_id` for session tracking.

## Project Structure

```text
backend/
├── app/
│   ├── config.py
│   ├── main.py
│   ├── ollama_client.py
│   ├── router.py
│   ├── schemas.py
│   ├── processor/
│   │   ├── processor.py
│   │   └── system_prompt.py
│   ├── database/
│   │   ├── database.py
│   │   ├── session.py
│   │   ├── models.py
│   │   └── init_db.py
│   ├── services/
│   │   ├── chat_service.py
│   │   ├── database_service.py
│   │   ├── memory_service.py
│   │   └── tool_service.py
│   ├── tools/
│   │   ├── base_tool.py
│   │   ├── calculator.py
│   │   ├── datetime_tool.py
│   │   ├── planner.py
│   │   └── registry.py
│   └── utils/
│       └── logger.py
├── logs/
├── requirements.txt
└── README.md
```

## Tool Support

The backend currently includes:

- `calculator`
- `datetime` / `date & time`

If the processor flags `needs_tool`, the tool executes directly and bypasses the LLM.

## Notes

- The processor uses `qwen2.5:1.5b` to analyze and classify incoming text.
- The router maps detected intents to a local Ollama model.
- Conversation memory is stored in memory for the current session.
- Request metadata is saved to PostgreSQL using SQLAlchemy and `asyncpg`.

## Roadmap

- Database-backed memory and retrieval
- Memory summarization
- Retrieval-augmented generation (RAG)
- Additional tool integrations
- Docker support and production deployment
- Authentication, monitoring, and rate limiting

## License

This repository is intended for experimentation, learning, and research in local AI orchestration.
