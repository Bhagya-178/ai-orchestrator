# AI Orchestrator Backend

A local AI orchestration backend built with FastAPI and Ollama.

This service processes incoming chat requests, detects intent, decides whether a tool call is needed, routes the request to the best local LLM, maintains session memory, logs performance metrics, and returns structured responses — all through a single orchestration pipeline.

## Key Features

- Intent-aware request processing
- Prompt optimization and normalization
- Deterministic + LLM tool detection and execution
- **Automatic document search detection** — detects when users ask questions about uploaded documents
- **RAG (Retrieval-Augmented Generation)** — token-based chunking and semantic search over user documents
- Model routing based on intent
- Streaming and non-streaming chat responses from one shared code path
- PostgreSQL-backed session memory
- PostgreSQL request logging and performance metrics
- Local Ollama model integration with Qdrant vector database

## Architecture Overview

Both `/chat` and `/chat/stream` consume the **same** `_turn()` event stream from the `ChatPipeline` service, so every stage below is implemented once and used by both endpoints:

1. **Processor** — the message is analyzed by `qwen2.5:1.5b` for intent, task type, entities, and prompt optimization. Deterministic detection runs first and short-circuits the LLM for: calculator (`25 * 16`), datetime (`what time is it?`), and **document search** (`explain the PDF`, `find X in my document`)
2. **Clarification** — if the processor flags `needs_clarification`, questions are returned and no model call is made
3. **Tools** — if a tool is required (calculator/datetime), it executes directly and returns a result, bypassing the LLM entirely. RAG queries skip tool execution to retrieve context first
4. **RAG Retrieval** *(Phase 3 — NEW)* — if `needs_rag=true`, the system retrieves semantically similar 512-token chunks from user's uploaded documents using Qdrant + embeddings. Retrieved context is injected into the prompt
5. **Router** — a model is selected from the registry based on the detected intent
6. **Memory** — the selected model receives the user message plus the session's history from Postgres (long sessions are folded into a rolling `session_summaries` row, so only the summary + most recent turns are sent)
7. **Generation** — the model streams its reply with document context; the final chunk carries Ollama metrics
8. **Persistence** — the turn is saved to memory
9. **Metrics** — request metadata is logged to PostgreSQL

Extension points are marked in the pipeline (`chat_pipeline.py` docstring) for upcoming phases:

- Phase 2 memory summarization / retrieval → stage 6 (Memory) — IN PROGRESS
- Phase 3 RAG / vector retrieval → stage 4 (between Tools ↔ Router) — **✅ SHIPPED**
- Phase 4 multi-tool planning → stage 3 (Tools)
- Phase 5 response caching → stage 7 (Generation)

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
- `QDRANT_URL` - Qdrant vector database URL (default: `http://localhost:6333`)
- `QDRANT_COLLECTION` - Collection name for document embeddings (default: `documents`)
- `EMBEDDING_MODEL` - Ollama embedding model for RAG (default: `bge-m3`)

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

Returns streamed text chunks from the selected Ollama model. Runs through the same pipeline stages as `/chat` (tools, RAG retrieval, routing, memory, metrics included).

### Document Upload (RAG)

```http
POST /documents/upload
```

Upload a PDF, DOCX, or TXT file for semantic search.

Request: multipart/form-data with `file` and `session_id`

Response:
- `document_id`: UUID of uploaded document
- `filename`: Name of the file
- `content_type`: MIME type
- `file_size`: Size in bytes
- `total_chunks`: Number of 512-token chunks created

### List Documents

```http
GET /documents?session_id=<session_id>
```

List all documents uploaded in a session.

### Delete Document

```http
DELETE /documents/{document_id}
```

Delete a document and all its chunks from Qdrant.

### Conversation Creation

```http
POST /conversations
```

Returns a new `conversation_id` for session tracking.

## Project Structure

```text
backend/                  # FastAPI Python Server
├── app/
│   ├── database/         # PostgreSQL DB (SQLAlchemy)
│   │   ├── database.py   
│   │   ├── init_db.py    
│   │   ├── models.py     
│   │   └── session.py    
│   ├── processor/        # Intent detection & system prompts
│   │   ├── processor.py  
│   │   ├── system_prompt.py
│   │   └── tool_detector.py
│   ├── services/         # Core business logic
│   │   ├── chat_pipeline.py
│   │   ├── database_service.py
│   │   ├── document_parser.py
│   │   ├── memory_service.py
│   │   ├── metrics.py    
│   │   ├── rag_service.py
│   │   └── tool_service.py
│   ├── tools/            # Deterministic tools
│   │   ├── base_tool.py  
│   │   ├── calculator.py 
│   │   ├── datetime_tool.py
│   │   └── registry.py   
│   ├── utils/            
│   │   └── logger.py     
│   ├── config.py         # Centralized configuration
│   ├── main.py           # FastAPI entrypoint
│   ├── ollama_client.py  
│   ├── registry.py       # Model routing registry
│   ├── router.py         
│   └── schemas.py        # Pydantic schemas
├── Dockerfile            
├── README.md             
└── requirements.txt      
```

## Tool Support

The backend includes three deterministic detectors:

### Built-in Tools
- `calculator` — arithmetic expressions: `25 * 16`, `100 / 4`, `15% of 200`
- `datetime` — current time/date queries: `what time is it?`, `what's the date today?`

### Document Search (RAG)
The processor detects document search queries automatically:
- **Patterns triggered:**
  - `"explain the X document"` / `"explain the PDF"`
  - `"search my documents for X"` / `"find X in my files"`
  - `"what is in my document?"` / `"summarize the PDF"`
  - `"extract X from the file"` / `"what does the document say?"`

Tool requests and document searches are detected deterministically (so the small classifier model can never misroute them) and again as a safety net on the LLM's normalized prompt. If the processor flags `needs_tool`, the tool executes directly and bypasses the LLM. If `needs_rag=true`, the document context is retrieved and injected into the generation prompt.

## Notes

- The processor uses `qwen2.5:1.5b` to analyze and classify incoming text.
- Deterministic detection (calculator, datetime, document search) runs BEFORE the LLM to avoid misclassification.
- The router maps detected intents to a local Ollama model based on `VALID_INTENTS`.
- **RAG Pipeline:**
  - Documents are split into **512-token chunks** (not characters) for optimal LLM performance (~2KB per chunk)
  - Chunks overlap by 64 tokens (~256 characters) for context continuity
  - Embeddings are generated using `bge-m3` model and stored in Qdrant
  - Top 5 semantic matches (score > 0.3) are retrieved and injected into the prompt
  - Fallback: If no semantic matches, raw chunks are returned
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
- ✅ Rolling conversation summarization (Phase 2) — long sessions fold old turns into a `session_summaries` row and prune the raw rows, keeping the model context bounded
- ✅ **Phase 3 RAG with token-based chunking** — deterministic document search detection, semantic retrieval, and prompt injection
- ✅ **Document upload endpoints** (`/documents/upload`, `/documents`, `/documents/{document_id}`)
- ✅ Request logging & metrics to PostgreSQL (latency, tokens/sec, context usage, CPU)
- ✅ Docker support and production deployment (`Dockerfile` and `docker-compose.yml`)

**In progress / next up:**

- 🔜 Phase 2 retrieval refinement — relevance-based turn selection (replace fixed window with semantic matching)
- 🔜 Multi-turn RAG context — carry retrieved chunks across follow-up questions in same session
- 🔜 RAG quality metrics — track retrieval precision/recall

**Planned:**

- Phase 4 — multi-tool planning (stage 3)
- Phase 5 — response caching (stage 7)
- Additional tool integrations (web search, API calls)
- Authentication, monitoring, and rate limiting
- Hybrid search (semantic + keyword BM25)

## License

This repository is intended for experimentation, learning, and research in local AI orchestration.
