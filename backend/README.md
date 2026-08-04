# AI Orchestrator

A production-oriented Local AI Orchestrator built with FastAPI and Ollama.

Unlike a traditional chatbot, this project intelligently processes incoming requests, determines the user's intent, detects whether tools are required, selects the most appropriate local LLM, and returns optimized responses while collecting detailed metrics.

---

# Features

## Intelligent Request Processing

- Intent Classification
- Prompt Normalization
- Clarification Detection
- Entity Extraction
- Tool Detection
- Web Requirement Detection
- Structured JSON Output

Processor Model:

```
qwen2.5:1.5b
```

---

## Model Routing

Automatically routes requests to the most suitable model.

Example routing:

| Intent | Model |
|---------|-------|
| General | Qwen3 |
| Coding | Qwen2.5-Coder |
| Study | Gemma |
| Reasoning | DeepSeek |

---

## Tool Calling

Supports direct tool execution without invoking a large language model.

Currently implemented:

- Calculator
- Date & Time

Example:

User

```
250 * 450
```

Processor

```
needs_tool = true
tool = calculator
```

Result

```
112500
```

The LLM is skipped completely, reducing latency from minutes to only a few seconds.

---

## Conversation Memory

Stores conversation history during a session and provides previous messages as context to the selected model.

Current implementation:

- In-memory conversation history

Planned:

- Database-backed memory
- Memory summarization
- Long-term memory retrieval

---

## PostgreSQL Logging

Every request is logged with useful metrics including:

- Original prompt
- Optimized prompt
- Intent
- Confidence
- Selected model
- Processor latency
- Generation latency
- Total latency
- Prompt tokens
- Completion tokens
- Response length
- Tokens/sec
- CPU usage
- Context usage
- Model load time

---

## Streaming Responses

Supports streaming responses from Ollama for real-time generation.

---

# Architecture

```
                    User
                      │
                      ▼
            Request Processor
            (qwen2.5:1.5B)
                      │
     ┌────────────────┴─────────────────┐
     │                                  │
Intent Classification         Prompt Normalization
     │                                  │
     ├──────────────┐                   │
     │              │                   │
Tool Detection   Web Detection          │
     │                                  │
     ▼                                  ▼
 Tool Service                        Router
     │                                 │
     │                           Select Best Model
     │                                 │
     ├──────── Yes ─────────────────────┘
     │
Execute Calculator /
DateTime Tool
     │
Return Result
     │
     └──────── No ─────────────────────►
                              Selected LLM
                       (Qwen3 / Gemma / DeepSeek)
                                       │
                               Memory Service
                                       │
                                Response Logger
                                       │
                                 PostgreSQL
                                       │
                                    Response
```

---

# Project Structure

```
ai-orchestrator/
│
├── app/
│   ├── main.py
│   ├── config.py
│   ├── router.py
│   ├── ollama_client.py
│   ├── schemas.py
│   │
│   ├── processor/
│   │   ├── processor.py
│   │   └── system_prompt.py
│   │
│   ├── database/
│   │   ├── database.py
│   │   ├── session.py
│   │   ├── models.py
│   │   └── init_db.py
│   │
│   ├── services/
│   │   ├── chat_service.py
│   │   ├── database_service.py
│   │   ├── memory_service.py
│   │   └── tool_service.py
│   │
│   ├── tools/
│   │   ├── base_tool.py
│   │   ├── registry.py
│   │   ├── calculator.py
│   │   ├── datetime_tool.py
│   │   └── planner.py
│   │
│   └── utils/
│       └── logger.py
│
├── logs/
│   └── requests.jsonl
│
├── requirements.txt
├── README.md
└── run.py
```

---

# Current Tech Stack

Backend

- FastAPI
- Python

LLM Runtime

- Ollama

Database

- PostgreSQL
- SQLAlchemy

Local Models

- Qwen3
- Gemma
- Qwen2.5-Coder
- DeepSeek
- Qwen2.5:1.5B (Processor)

---

# Current Progress

## Core Infrastructure

- ✅ FastAPI Backend
- ✅ Ollama Integration
- ✅ Processor
- ✅ Model Router
- ✅ Conversation Memory
- ✅ PostgreSQL Logging
- ✅ Streaming Responses

---

## Processor

- ✅ Intent Classification
- ✅ Prompt Normalization
- ✅ Clarification Detection
- ✅ Entity Extraction
- ✅ Tool Detection
- ✅ Web Requirement Detection

---

## Tools

- ✅ Tool Registry
- ✅ Tool Service
- ✅ Calculator
- ✅ Date & Time

---

## Metrics

- ✅ Request Latency
- ✅ Generation Latency
- ✅ Prompt Tokens
- ✅ Completion Tokens
- ✅ CPU Usage
- ✅ Tokens Per Second
- ✅ Context Usage
- ✅ Model Load Time

---

# Roadmap

## Phase 2 — Intelligence

- Better Conversation Memory
- Database-backed Memory
- Memory Summarization
- Context Retrieval
- Self-improving Router

---

## Phase 3 — Knowledge

- Retrieval-Augmented Generation (RAG)
- Vector Database
- Embedding Models
- Document Ingestion
- Local Knowledge Base

---

## Phase 4 — Automation

- Web Search
- File Reader
- File Writer
- API Tools
- Email Tools
- Weather Tool
- Currency Converter
- Unit Converter
- n8n Integration
- MCP Integration

---

## Phase 5 — Production

- Docker
- Authentication
- Rate Limiting
- Monitoring
- Benchmarking
- Response Caching
- Frontend Dashboard

---

# Project Vision

The goal of this project is to build a production-quality Local AI Orchestrator rather than a simple chatbot.

The orchestrator should:

- Understand user intent
- Normalize prompts
- Detect and execute tools
- Route requests to the best local LLM
- Integrate external knowledge through Web Search and RAG
- Support multi-tool planning and orchestration
- Maintain conversation context
- Collect detailed performance metrics
- Operate entirely with local models

Ultimately, it will function as a modular AI gateway capable of coordinating multiple language models, tools, and knowledge sources through a single intelligent orchestration pipeline.

---

# License

This project is intended for learning, experimentation, and research into AI orchestration systems.