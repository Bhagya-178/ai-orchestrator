# AI Orchestrator Backend

A local AI orchestration backend built with FastAPI and Ollama.

This service processes incoming chat requests, detects intent, decides whether a tool call is needed, routes the request to the best local LLM, maintains session memory, logs performance metrics, and returns structured responses — all through a single orchestration pipeline.

## Key Features

- Intent-aware request processing
- Prompt optimization and normalization
- Deterministic + LLM tool detection and execution
- Model routing based on intent
- Streaming and non-streaming chat responses from one shared code path
- PostgreSQL-backed session memory
- PostgreSQL request logging and performance metrics
- Local Ollama model integration

## Architecture Overview

Both `/chat` and `/chat/stream` consume the **same** `_turn()` event stream from the `ChatPipeline` service, so every stage below is implemented once and used by both endpoints:

1. **Processor** — the message is analyzed by `qwen2.5:1.5b` for intent, task type, entities, and prompt optimization (deterministic tool detection runs first and short-circuits the LLM for clear calculator / date & time requests)
2. **Clarification** — if the processor flags `needs_clarification`, questions are returned and no model call is made
3. **Tools** — if a tool is required, it executes directly and returns a result, bypassing the LLM entirely
4. **Router** — otherwise a model is selected from the registry based on the detected intent
5. **Memory** — the selected model receives the user message plus the session's history from Postgres (long sessions are folded into a rolling `session_summaries` row, so only the summary + most recent turns are sent)
6. **Generation** — the model streams its reply; the final chunk carries Ollama metrics
7. **Persistence** — the turn is saved to memory
8. **Metrics** — request metadata is logged to PostgreSQL

Extension points are marked in the pipeline (`chat_pipeline.py` docstring) for upcoming phases:

- Phase 2 memory summarization / retrieval → stage 5 (Memory)
- Phase 3 RAG / vector retrieval → new stage between 3 and 4 (Tools ↔ Router)
- Phase 4 multi-tool planning → stage 3 (Tools)
- Phase 5 response caching → stage 6 (Generation)

## Supported Models

The model registry maps intents to local Ollama models:

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
  "message": "Hello, what can you do?",
  "session_id": "optional-existing-session"
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

Returns streamed text chunks from the selected Ollama model. Runs through the same pipeline stages as `/chat` (tools, routing, memory, metrics included).

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
│   ├── registry.py
│   ├── router.py
│   ├── schemas.py
│   ├── processor/
│   │   ├── processor.py
│   │   ├── system_prompt.py
│   │   └── tool_detector.py
│   ├── database/
│   │   ├── database.py
│   │   ├── init_db.py
│   │   ├── models.py
│   │   └── session.py
│   ├── services/
│   │   ├── chat_pipeline.py
│   │   ├── database_service.py
│   │   ├── memory_service.py
│   │   ├── metrics.py
│   │   └── tool_service.py
│   ├── tools/
│   │   ├── base_tool.py
│   │   ├── calculator.py
│   │   ├── datetime_tool.py
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

Tool requests are detected deterministically first (so the small classifier model can never misroute them) and again as a safety net on the LLM's normalized prompt. If the processor flags `needs_tool`, the tool executes directly and bypasses the LLM.

## Notes

- The processor uses `qwen2.5:1.5b` to analyze and classify incoming text.
- The router maps detected intents to a local Ollama model.
- Conversation memory is stored in PostgreSQL, so history survives server restarts and can be reloaded for any session.
- Request metadata (latency, tokens/sec, context usage, CPU) is saved to PostgreSQL using SQLAlchemy and `asyncpg`.
- If the processor call fails, the pipeline degrades to a plain `general` turn instead of crashing the request.

## Roadmap & Current Status

**Shipped (current state):**

- ✅ Unified `ChatPipeline` shared by `/chat` and `/chat/stream` (single `_turn()` code path)
- ✅ Intent-aware processing with deterministic + LLM tool detection
- ✅ Tool execution (calculator, datetime) that bypasses the LLM
- ✅ Intent-based model routing
- ✅ PostgreSQL-backed session memory (history survives restarts)
- ✅ Rolling conversation summarization (Phase 2) — long sessions fold old turns into a `session_summaries` row and prune the raw rows, keeping the model context bounded (tunable via `HISTORY_SUMMARIZE_AFTER` / `HISTORY_RECENT_MESSAGES` in `memory_service.py`)
- ✅ Request logging & metrics to PostgreSQL (latency, tokens/sec, context usage, CPU)

**In progress / next up:**

- 🔜 Phase 2 retrieval — relevant-turn selection (today `get_history()` sends the summary + most recent N raw messages; next step is replacing the fixed window with relevance-based retrieval)
- 🔜 Phase 3 — RAG / vector retrieval (new stage between 3 and 4)

**Planned:**

- Phase 4 — multi-tool planning (stage 3)
- Phase 5 — response caching (stage 6)
- Additional tool integrations
- Docker support and production deployment
- Authentication, monitoring, and rate limiting

## License

This repository is intended for experimentation, learning, and research in local AI orchestration.
