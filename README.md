<div align="center">
  <h1>🤖 AI Orchestrator</h1>
  <p><i>A local multi-model LLM orchestration platform that automatically routes user requests to specialized models while integrating deterministic tools, RAG, conversation memory, streaming, and observability.</i></p>

  [![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Ollama](https://img.shields.io/badge/Ollama-Local_LLMs-white?logo=ollama)](#)
  [![Qdrant](https://img.shields.io/badge/Qdrant-Vector_DB-red?logo=qdrant)](#)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue?logo=postgresql)](#)
</div>

---

## ⚡ The Problem

**A single general-purpose LLM is not necessarily the best model for every task.** 

Different models perform better on different workloads (e.g., DeepSeek for reasoning, Qwen Coder for programming). However, asking users to manually select a model for every single prompt creates unnecessary friction and complexity. Furthermore, using massive heavyweight models for simple arithmetic or basic queries wastes immense inference time and computational resources.

## 🎯 The Solution

**AI Orchestrator** introduces a seamless orchestration layer for local LLMs. 

The orchestration pipeline analyzes incoming requests and uses a lightweight classifier (`qwen2.5:1.5b`) for model selection when LLM inference is required. It then autonomously routes the request to a highly-specialized heavyweight model. The pipeline is further extended with deterministic Python tools and Retrieval-Augmented Generation (RAG), ensuring calculations bypass LLM inference entirely and document queries retrieve semantic context automatically.

### Intent Routing Pipeline

```text
                    User Query
                        │
                        ▼
                ┌───────────────┐
                │ Intent Router │
                │ qwen2.5:1.5b  │
                └───────┬───────┘
                        │
      ┌─────────┬───────┴───────┬─────────┐
      │         │               │         │
      ▼         ▼               ▼         ▼
   General    Coding        Reasoning   Study
      │         │               │         │
      ▼         ▼               ▼         ▼
    qwen3  qwen2.5-coder  deepseek-r1   gemma4
```

### RAG Pipeline

When documents (PDF, DOCX, TXT) are uploaded to a chat, they are automatically embedded without the user needing to type specific commands:

```text
 Uploaded File ──► Parse & Chunk ──► BGE-M3 Embeddings ──► Qdrant Vector DB
                                                                │
                                                                ▼
                                                        Relevant Chunks
                                                                │
 User Query ────────────────────────────────────────────────────┼──► Target LLM
```

## 🏗️ System Architecture

```text
                         Chat Request
                              │
                              ▼
                       Chat Pipeline
                              │
                              ▼
                         Processor
                       (qwen2.5:1.5b)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
               Tool?                    LLM Task
                 │                         │
                 ▼                         ▼
            Python Tool               Model Router
                 │                         │
                 │            ┌────────────┼────────────┐
                 │            ▼            ▼            ▼
                 │           RAG         Memory    Target Model
                 │            │            │            │
                 │            └────────────┼────────────┘
                 │                         │
                 │                         ▼
                 │                       Ollama
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
                           Response
```

### Request Lifecycle
1. **Processor Phase:** `qwen2.5:1.5b` analyzes the prompt to determine the *intent* (General, Coding, Study, Reasoning).
2. **Deterministic Tools:** If the prompt is a direct math equation or time query, Python computes deterministic operations locally after request analysis, avoiding heavyweight model inference and improving numerical reliability.
3. **Model Router:** If LLM inference is required, the orchestrator selects the appropriate specialized model based on the detected intent.
4. **RAG Retrieval:** If a document was uploaded, the prompt is vectorized with `bge-m3`, cross-referenced in Qdrant, and relevant chunks are appended to the system context.
5. **Streaming Response:** The output streams back to the UI in real-time via Server-Sent Events (SSE), with request and performance metrics persisted in PostgreSQL.

---

## ✨ Key Features

| Feature | How it works |
|---|---|
| **Intelligent Routing** | `qwen2.5:1.5b` performs lightweight intent classification and determines the appropriate specialized model for Coding, Reasoning, Study, or General conversation. |
| **Deterministic Tools** | Math equations (`25 * 16`) and datetime queries are evaluated natively in Python, avoiding heavyweight model inference and eliminating LLM arithmetic hallucinations. |
| **Automatic RAG** | Upload files directly into the chat. The system vectorizes them and fetches semantic context automatically when relevant to your prompt. |
| **Conversation Context Management** | Historical conversations are summarized and selectively retrieved to reduce unnecessary context tokens while preserving relevant conversation history. |
| **Local & Privacy-First** | Models and application data run locally through Ollama, PostgreSQL, and Qdrant without requiring a third-party LLM API. |
| **Observability** | PostgreSQL-backed metrics record request latency, selected models, tool execution, and pipeline activity for debugging. |

---

## 🔬 Engineering Decisions

### Why a lightweight routing model?
Instead of sending every request directly to a heavyweight model, the system first performs intent classification using `qwen2.5:1.5b`. This separates request classification from task execution and allows specialized models to handle workloads they are better suited for.

### Why deterministic tools?
Arithmetic and datetime operations do not require probabilistic language generation. Executing them directly in Python improves reliability and avoids unnecessary LLM inference.

### Why RAG?
Passing an entire document into every prompt increases context size and inference cost. The system instead converts documents into embeddings and retrieves only semantically relevant chunks from Qdrant.

### Why local inference?
Ollama allows the system to run open-source models locally, avoiding dependency on external LLM APIs and providing greater control over data and model execution.

### Why PostgreSQL + Qdrant?
PostgreSQL stores structured application data such as conversations, messages, and metrics, while Qdrant is optimized for vector similarity search. Separating these responsibilities keeps the data layer aligned with each workload.

---

## 🧰 Tech Stack

### Backend
- Python 3.12
- FastAPI
- Pydantic
- SQLAlchemy
- PostgreSQL

### AI / ML
- Ollama
- Qwen
- DeepSeek
- Gemma
- BGE-M3
- Qdrant
- Retrieval-Augmented Generation (RAG)

### Frontend
- Next.js 15
- React
- TypeScript
- Tailwind CSS

### Infrastructure
- Server-Sent Events (SSE)

---

## ⚠️ Current Limitations

- Local inference performance depends heavily on available CPU/GPU memory.
- Model routing accuracy depends on the classifier's intent classification.
- RAG quality depends on document parsing, chunking, and embedding quality.
- The current deployment is optimized for local/single-user usage rather than large-scale concurrent workloads.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Qdrant](https://qdrant.tech/) (Running via Docker or native)
- [Ollama](https://ollama.com/) (Running locally)

**Required Ollama Models:**
Pull the required models before starting:
```bash
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
ollama pull gemma4:e4b
ollama pull deepseek-r1:8b
ollama pull qwen2.5:1.5b
ollama pull bge-m3
```

### 1. Start the Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # On Windows
# source .venv/bin/activate # On Mac/Linux

pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory with your database connection strings (see `backend/README.md` for defaults). 

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend (Next.js 15)

```bash
cd frontend
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser. The frontend will automatically connect to your running backend API.

---

## 📂 Project Structure

```text
ai-orchestrator/
│
├── backend/                  # FastAPI Python Server
│   ├── app/
│   │   ├── database/         # PostgreSQL DB (SQLAlchemy/Alembic)
│   │   ├── processor/        # Intent detection & system prompts
│   │   ├── services/         # RAG, Chat Pipeline, Memory, Metrics
│   │   └── tools/            # Deterministic tools (Calculator, Datetime)
│   └── README.md             
│
├── frontend/                 # Next.js React Application
│   ├── app/
│   │   ├── components/       # UI Components (Chat, Documents, Sidebar)
│   │   └── lib/              # API abstractions & React Contexts
│   └── README.md             
│
└── README.md                 # Project Overview
```

---

<div align="center">
  <p>Built for exploration and mastery in Local AI orchestration.</p>
</div>
