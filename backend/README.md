# 🚀 AI Orchestrator Backend Core

A production-grade, enterprise-scale AI orchestration backend built with **FastAPI**, **PostgreSQL**, **Qdrant**, and **Ollama**.

The backend serves as the deterministic orchestration engine for private, local LLMs—providing intent classification, multi-agent DAG workflows, hybrid sparse/dense RAG, entity knowledge graphs, semantic vector caching, a sandboxed ReAct tool ecosystem, and a full developer platform with programmatic API keys and HMAC-signed webhooks.

---

## ⚡ Architectural Subsystems

### 1. Multi-Agent Directed Acyclic Graph (DAG) Engine (`app/agents/`)
- **Topological Sorting**: Deconstructs multi-node task graphs into parallel execution waves using Kahn's algorithm with cycle and dead-end detection.
- **5 Autonomous Personas**:
  - `PlannerAgent`: High-level strategic task decomposition and milestone planning.
  - `ResearcherAgent`: Grounded fact extraction across documents, web search, and tools.
  - `CoderAgent`: Production-grade, typed code, tests, and configuration generation.
  - `ReviewerAgent`: Security auditing, edge-case analysis, and bug detection.
  - `CriticAgent`: Multi-source synthesis, constraint validation, and scoring.
- **Streaming Telemetry**: Mounted at `/agents/workflows/run` with Server-Sent Events (SSE) streaming node state transitions, thoughts, and outputs.

### 2. Entity Knowledge Graph & Graph RAG (`app/services/rag_v2/`)
- **AST Extraction**: Traverses Python AST syntax trees to extract classes, functions, inheritance (`inherits`), definitions (`defines`), and module imports (`imports`).
- **Graph Centrality**: In-memory topological graph computing PageRank centrality, degree centrality, and BFS/Dijkstra shortest pathfinding.
- **Graph RAG Augmentation**: Expands user queries along high-centrality entity links and injects connected relationship context directly into LLM prompts.

### 3. Semantic Vector Caching (`app/services/semantic_cache.py`)
- **Exact Hash Matching**: $O(1)$ cache lookup for normalized query hashes.
- **Vector Cosine Similarity Matching**: Caches query embeddings; hits when similarity exceeds threshold ($\ge 0.92$), reducing turn latency from seconds to $< 2$ms.
- **Lifecycle & Policies**: LRU eviction at max capacity, 24-hour TTL expiration, and telemetry tracking saved tokens and cost estimates.

### 4. Sandboxed ReAct Tool Ecosystem (`app/tools/`)
- **AST Mathematical Calculator**: Safe AST expression evaluator strictly preventing `eval()`, `__import__`, built-ins, and dunder attribute access.
- **SQL Query Tool**: AST-enforced read-only `SELECT` executor blocking `DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, and stacked queries.
- **File System Tool**: Workspace-sandboxed file and directory operations with path traversal protection against `../`, `..\`, and null-byte (`\x00`) injections.
- **Web Search & Scraper**: HTTP scrapers with HTML-to-text extraction and rate-limited search.
- **Declarative Chart Generator**: Generates Chart.js configurations for bar, line, and pie charts.

### 5. Developer Platform: API Keys & Webhooks (`app/auth/`, `app/services/`)
- **Programmatic API Keys**: High-entropy keys (`ak_live_...`, `ak_test_...`), SHA-256 hashed storage, display prefix redaction, and granular permission scopes (`chat:read`, `chat:write`, `rag:admin`, `agents:run`).
- **Enterprise Webhooks**: Asynchronous event dispatch with HMAC-SHA256 signature headers (`X-Orchestrator-Signature: t={timestamp},v1={sig}`) and 300s replay resistance.
- **Delivery Audit Logs**: `webhook_deliveries` database table logging HTTP statuses, latencies, and error responses.

### 6. LLM-as-a-Judge Evaluation Suite (`app/services/evals/`)
- **Automated Evaluator Metrics**:
  - *Faithfulness*: Grounding ratio against retrieved context chunks.
  - *Answer Relevance*: Semantic alignment between prompt and generated reply.
  - *Hallucination Index*: Detected unsupported factual claims.
- **Benchmark Suites**: Curated datasets for Coding, Reasoning & Logic, and RAG Grounding with historical run tracking.

### 7. Hybrid RAG 2.0 (`app/services/rag_v2/`)
- **Sparse BM25Okapi**: Inverted index scoring lexical keyword matches.
- **Dense Vector Embeddings**: Cosine similarity retrieval over Qdrant 512-token chunks using `bge-m3`.
- **Reciprocal Rank Fusion (RRF)**: Merges dense and sparse ranks via $RRF(d) = \sum \frac{1}{60 + \text{rank}}$.

---

## 🛡️ Security & Vulnerability Test Suite (113 Tests)

The backend features an automated 113-test security audit verifying zero vulnerabilities across 12 critical domains.

### Running the Full Audit
```bash
python backend/scratch/test_vulnerability_and_enterprise_113.py
```

| Category | Domain | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Cat 1** | Authentication & Password Security (PBKDF2, Salting, JWT HS256) | 10 | **PASS (10/10)** |
| **Cat 2** | API Key Security & Cryptography (SHA-256, Scopes, Entropy) | 10 | **PASS (10/10)** |
| **Cat 3** | Webhook HMAC-SHA256 & Replay Protection (Signatures, Timestamps) | 10 | **PASS (10/10)** |
| **Cat 4** | SQL Injection Defense (Read-only SELECT, keyword blocking) | 10 | **PASS (10/10)** |
| **Cat 5** | Path Traversal & File Sandbox Defense (Null-bytes, ../, root escapes) | 10 | **PASS (10/10)** |
| **Cat 6** | Arbitrary Code Execution / AST Math Sandbox (eval blocking, dunder defense) | 10 | **PASS (10/10)** |
| **Cat 7** | Multi-Agent DAG Workflow Engine (Kahn's toposort, cycles, parallel waves) | 10 | **PASS (10/10)** |
| **Cat 8** | Knowledge Graph & Entity Network (AST extraction, PageRank, BFS path) | 10 | **PASS (10/10)** |
| **Cat 9** | Semantic Vector Caching (Cosine similarity, exact hit, TTL, LRU) | 10 | **PASS (10/10)** |
| **Cat 10** | Hybrid RAG 2.0 & Retrieval (BM25 sparse, RRF fusion, chunking) | 10 | **PASS (10/10)** |
| **Cat 11** | LLM-as-a-Judge Evals & Benchmarks (Faithfulness, Relevance, Hallucination) | 6 | **PASS (6/6)** |
| **Cat 12** | Role-Based Access Control (RBAC), Workspaces & System Integrity | 7 | **PASS (7/7)** |
| **TOTAL** | **Enterprise & Vulnerability Audit** | **113** | **113 / 113 PASSED** |

> [!NOTE]
> **Zero-C Compilation**: All cryptography (API keys, Webhook HMAC-SHA256 signatures, PBKDF2, JWT) uses Python's standard library `hashlib`, `hmac`, and `secrets`. This ensures native cross-platform compatibility without GCC or Visual Studio Build Tools.

---

## 📡 Complete REST & SSE Route Reference

### Authentication & API Keys
- `POST /auth/register`: Create user account.
- `POST /auth/login`: Authenticate and obtain JWT access + refresh tokens.
- `POST /auth/refresh`: Refresh expired JWT access token.
- `GET /auth/me`: Current user profile and custom instructions.
- `GET /auth/api-keys`: List active API keys.
- `POST /auth/api-keys`: Create scoped API key (returns raw key once).
- `DELETE /auth/api-keys/{key_id}`: Revoke an API key.

### Core Chat & Memory
- `POST /chat`: Synchronous execution with intent classification and memory.
- `POST /chat/stream`: Real-time SSE token stream with latency tracking and inline tool events.
- `POST /chat/regenerate`: Retry last assistant response.
- `GET /conversations`: List paginated conversation threads.
- `GET /chat/{session_id}/messages`: Message history for a specific conversation.
- `DELETE /conversations/{session_id}`: Delete conversation and associated memory summaries.

### Multi-Agent Workflows
- `GET /agents/roles`: List available autonomous personas.
- `GET /agents/templates`: Pre-built DAG workflow templates.
- `POST /agents/workflows/run`: Execute a multi-agent DAG workflow with real-time SSE stream.
- `POST /agents/roles/chat`: Single-turn interaction with an isolated agent role.

### Hybrid RAG & Knowledge Graph
- `POST /documents/upload`: Upload PDF, DOCX, or TXT for chunking and vector ingestion.
- `GET /documents/{session_id}`: List ingested documents for a session.
- `DELETE /documents/{doc_id}`: Delete document and prune vector chunks from Qdrant.
- `GET /rag/v2/graph/explore`: Return nodes and edges for 2D visualizer.
- `GET /rag/v2/graph/path`: Shortest path between two code entities.
- `POST /rag/v2/graph/index-code`: Parse code file into the knowledge graph.
- `GET /rag/v2/graph/query-augment`: Contextual graph snippet for prompt augmentation.

### Developer Webhooks
- `GET /webhooks`: List subscribed webhook endpoints.
- `POST /webhooks`: Register a webhook URL and subscribed events.
- `DELETE /webhooks/{webhook_id}`: Unregister a webhook endpoint.
- `POST /webhooks/{webhook_id}/test`: Trigger test HMAC-signed ping.
- `GET /webhooks/{webhook_id}/deliveries`: View past webhook delivery attempts.

### LLM Evals & Benchmarks
- `GET /evals/benchmarks`: List benchmark test suites.
- `POST /evals/run`: Execute LLM-as-a-judge evaluation run.
- `GET /evals/history`: Historical evaluation run results.

### Agentic Tools
- `GET /tools`: List registered tools, parameter schemas, and risk levels.
- `POST /tools/execute`: Direct tool execution endpoint.
- `POST /tools/agent/stream`: ReAct autonomous reasoning agent SSE stream.

---

## 🐳 Docker Deployment & Container Updates

The backend is fully containerized using a hardened multi-stage `python:3.12-slim` image with a non-root `appuser` and built-in health check.

### Running with Docker Compose
From the repository root:
```bash
docker compose up -d backend
```

### 🔄 How to Update the Backend Container
When updating backend code, schemas, or requirements:

1. **Rebuild without cache**:
   ```bash
   docker compose build --no-cache backend
   docker compose up -d --no-deps backend
   ```

2. **Run database migrations inside the container**:
   ```bash
   docker compose exec backend python -m app.database.init_db
   ```

3. **Check container health and logs**:
   ```bash
   docker compose ps backend
   docker compose logs -f --tail=100 backend
   ```

4. **Verify container health check directly**:
   ```bash
   docker compose exec backend python -c "import httpx; print(httpx.get('http://localhost:8000/health').json())"
   ```

---

## 💻 Local Development Setup

### 1. Python Virtual Environment
```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Environment Variables (`.env`)
Create `backend/.env`:
```env
APP_NAME=AI Orchestrator
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ai_orchestrator
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=documents
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=bge-m3:latest
PROCESSOR_MODEL=qwen2.5:1.5b
SUMMARY_MODEL=qwen2.5:1.5b
RAG_MODEL=qwen3:8b
JWT_SECRET_KEY=dev-secret-key-replace-in-production-32-chars-min
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

### 3. Initialize Database Schema
```bash
python -m app.database.init_db
```

### 4. Start the Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
