# 🚀 AI Orchestrator Backend Core

A production-grade, enterprise-scale AI orchestration backend built with **FastAPI**, **PostgreSQL**, **Qdrant**, and **Ollama**.

The backend serves as the deterministic orchestration engine for private, local LLMs—providing intent classification, multi-agent DAG workflows, hybrid sparse/dense RAG, entity knowledge graphs, semantic vector caching, a sandboxed ReAct tool ecosystem, and a full developer platform with programmatic API keys and HMAC-signed webhooks.

> [!TIP]
> **Complete User & Architecture Manual**: Refer to [**`../GUIDE.md`**](../GUIDE.md) for end-to-end documentation on the ReAct coding loop, tool catalog, Canvas Studio 2.0, Model Arena single-GPU VRAM unloading, and setup tutorials.

---

## ⚡ Architectural Subsystems

### 1. Multi-Agent Swarm & DAG Workflow Engine (`app/agents/`, `app/services/`)
- **Topological Sorting**: Deconstructs multi-node task graphs into parallel execution waves using Kahn's algorithm with cycle and dead-end detection.
- **5 Specialized Autonomous Roles**:
  - `PlannerAgent`: High-level strategic task decomposition, architecture blueprinting, and schema planning.
  - `ResearcherAgent`: Grounded technical research across documents, web search, and external library APIs.
  - `CoderAgent`: Production-grade, typed source code, tests, and configuration generation.
  - `ReviewerAgent`: Security auditing, edge-case analysis, input sanitization, and bug detection.
  - `CriticAgent`: Multi-source synthesis, constraint validation, and quality scorecard deliverable.
- **Dynamic Effort Scaling & Token Budgeting (`effort_level: 'low' | 'medium' | 'high'`)**:
  - *⚡ Low Effort*: Dynamically prunes non-essential QA/Critic nodes from the DAG, executing only core roles (`planner`, `coder`, `researcher`) with a 600-token budget and concise implementation directives to return verified code deliverables in ~20 seconds.
  - *⚖️ Medium Effort*: Runs the standard full 5-agent DAG wave topology (`planner` $\rightarrow$ `backend coder` $\rightarrow$ `frontend coder` $\rightarrow$ `reviewer` $\rightarrow$ `critic`) with a 1200-token budget per agent in ~60 seconds.
  - *🧠 High Effort & Autonomous Reflection Loop*: Allocates a 2500-token budget, executes the full 5-agent DAG, inspects the Reviewer's security audit for vulnerabilities or bugs, and if findings are detected, automatically launches an autonomous `security_patch_loop` node with the Coder Agent to patch and harden the code before final delivery.
- **Single-GPU Sequential Execution & Optimization**:
  - Waves execute sequentially against local Ollama, ensuring 100% of GPU resources and memory bandwidth are allocated to one model at a time.
  - Prompt de-duplication prevents re-injecting upstream deliverables into context if already substituted in the node prompt template, cutting prompt ingestion latency in half.
- **Dual-Layer Execution & Live Streaming**:
  - *In-Chat Zero-Friction Swarm*: Triggered via `/workflow` prompt commands or `workflow:*` intent routing in `chat_pipeline.py`. Immediately streams the workflow header at $t = 0$ and yields each agent's deliverable token-by-token the instant `node_complete` fires. Commits full deliverables directly to PostgreSQL chat history.
  - *Agent Operations Studio*: Full visual DAG orchestration with Server-Sent Events (SSE) streaming node state transitions, intermediate thoughts, and durations.
- **Persistent Workflow Runs (`WorkflowRun` Table)**: Every execution saves full JSONB intermediate node outputs, node timings, and final synthesis in PostgreSQL (`/agents/runs`), enabling cross-session retrieval and inspection.
- **Dynamic ReAct Multi-Loop Reasoning (`app/tools/agent_loop.py`)**:
  - Scales execution budget by user effort level:
    - **Low**: 2 max iterations, temperature 0.1
    - **Medium**: 5 max iterations, temperature 0.2
    - **High**: 10 max iterations, temperature 0.3
  - Yields real-time step telemetry (`thought`, `tool_start`, `tool_result`, `token`, `done`) with regex markdown fence stripping and parameter bridge healing.

### 2. Cryptographic Email OTP Verification & RBAC (`app/auth/`, `app/services/email_service.py`)
- **Pending Registration Isolation**: Unverified user data is quarantined in the `email_verifications` table so unverified accounts never pollute primary `users` or foreign key constraints.
- **Cryptographic OTP Security**:
  - High-entropy 6-digit OTP codes generated via `secrets`.
  - Stored using SHA-256 with pepper hashing and constant-time validation (`hmac.compare_digest`).
  - 10-minute expiration with a 5-attempt brute force lockout limit.
  - 60-second cooldown rate-limiting on OTP generation and resends.
- **Dual Email Delivery Engine**:
  - *Production SMTP*: Asynchronous TLS delivery via standard library `smtplib` and `EmailMessage` with responsive HTML and plain-text templates.
- **Administrative Account Provisioning**:
  - Configured strictly via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). No default admin passwords are hardcoded or published in the repository.
  - On initial database bootstrap, if `ADMIN_PASSWORD` is not set and no admin user exists, a cryptographically secure random one-time password is generated and logged to the server terminal, prompting immediate `.env` configuration.

### 3. Entity Knowledge Graph & Graph RAG (`app/services/rag_v2/`)
- **AST Extraction**: Traverses Python AST syntax trees to extract classes, functions, inheritance (`inherits`), definitions (`defines`), and module imports (`imports`).
- **Graph Centrality**: In-memory topological graph computing PageRank centrality, degree centrality, and BFS/Dijkstra shortest pathfinding.
- **Graph RAG Augmentation**: Expands user queries along high-centrality entity links and injects connected relationship context directly into LLM prompts.

### 4. Semantic Vector Caching (`app/services/semantic_cache.py`)
- **Exact Hash Matching**: $O(1)$ cache lookup for normalized query hashes.
- **Vector Cosine Similarity Matching**: Caches query embeddings; hits when similarity exceeds threshold ($\ge 0.92$), reducing turn latency from seconds to $< 2$ms.
- **Lifecycle & Policies**: LRU eviction at max capacity, 24-hour TTL expiration, and telemetry tracking saved tokens and cost estimates.

### 5. Sandboxed ReAct Tool Ecosystem (`app/tools/`)
- **AST Mathematical Calculator**: Safe AST expression evaluator strictly preventing `eval()`, `__import__`, built-ins, and dunder attribute access.
- **SQL Query Tool**: AST-enforced read-only `SELECT` executor blocking `DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, and stacked queries.
- **File System Tool**: Workspace-sandboxed file and directory operations with path traversal protection against `../`, `..\`, and null-byte (`\x00`) injections.
- **Web Search & Scraper**: HTTP scrapers with HTML-to-text extraction and rate-limited search.
- **Declarative Chart Generator**: Generates Chart.js configurations for bar, line, and pie charts.

### 6. Developer Platform: API Keys & Webhooks (`app/auth/`, `app/services/`)
- **Programmatic API Keys**: High-entropy keys (`ak_live_...`, `ak_test_...`), SHA-256 hashed storage, display prefix redaction, and granular permission scopes (`chat:read`, `chat:write`, `rag:admin`, `agents:run`).
- **Enterprise Webhooks**: Asynchronous event dispatch with HMAC-SHA256 signature headers (`X-Orchestrator-Signature: t={timestamp},v1={sig}`) and 300s replay resistance.
- **Delivery Audit Logs**: `webhook_deliveries` database table logging HTTP statuses, latencies, and error responses.

### 7. LLM-as-a-Judge Evaluation Suite (`app/services/evals/`)
- **Automated Evaluator Metrics**:
  - *Faithfulness*: Grounding ratio against retrieved context chunks.
  - *Answer Relevance*: Semantic alignment between prompt and generated reply.
  - *Hallucination Index*: Detected unsupported factual claims.
- **Benchmark Suites**: Curated datasets for Coding, Reasoning & Logic, and RAG Grounding with historical run tracking.

### 8. Hybrid RAG 2.0 (`app/services/rag_v2/`)
- **Sparse BM25Okapi**: Inverted index scoring lexical keyword matches.
- **Dense Vector Embeddings**: Cosine similarity retrieval over Qdrant 512-token chunks using `bge-m3`.
- **Reciprocal Rank Fusion (RRF)**: Merges dense and sparse ranks via $RRF(d) = \sum \frac{1}{60 + \text{rank}}$.

---

## 🛡️ Enterprise Automated Test Suite (200 Pytest Tests)

The backend features an automated **200-test verification suite** exercising zero vulnerabilities, correct cryptographic operations, and deterministic workflow states across 20 critical architectural domains:

```
tests/
├── unit/
│   ├── test_schemas.py           # Pydantic schemas, CORS config, Keep-Alive settings
│   └── test_tools.py             # Tool registry, dynamic dispatch & metadata validation
├── integration/
│   ├── test_auth_lifecycle.py    # PBKDF2 salting, password verification, unicode security
│   ├── test_jwt.py               # HS256 JWT lifecycle, expiration & signature tampering
│   ├── test_api_keys.py          # Cryptographic entropy, SHA-256 hashes, scope enforcement
│   └── test_webhooks.py          # HMAC-SHA256 signatures, replay drift & timestamp validation
├── security/
│   ├── test_sql_injection.py     # Read-only SELECT enforcement & injection prevention
│   ├── test_filesystem_sandbox.py# Path traversal, null-byte injection & UNC escape defenses
│   └── test_math_sandbox.py      # AST mathematical evaluation & unsafe dunder/eval blocking
├── rag/
│   ├── test_knowledge_graph.py   # Topology, PageRank centrality, BFS & AST code extraction
│   ├── test_semantic_cache.py    # Cosine vector cache, LRU eviction, TTL & cost telemetry
│   └── test_hybrid_search.py     # BM25Okapi sparse search, chunking & Reciprocal Rank Fusion
├── agents/
│   ├── test_dag_engine.py        # Kahn's topological sort, cycle detection & parallel waves
│   └── test_agent_personas.py    # 5-agent role prompts, system prompt immutability & schemas
└── routing/
    ├── test_evals_engine.py      # LLM-as-a-judge faithfulness, relevance & benchmark suites
    ├── test_model_arena.py       # Blind arena battles, VRAM sequential loading & Elo voting
    └── test_model_router.py      # Task-based dynamic model routing & safe fallbacks
```

### Running the Test Suite
From the repository root or `backend/`:
```powershell
pytest
```

Or target specific functional test directories:
```powershell
pytest tests/security/       # 30 security sandbox & injection tests
pytest tests/rag/            # 60 Knowledge Graph, BM25 & Semantic Cache tests
pytest tests/agents/         # 20 DAG workflow & multi-agent persona tests
pytest tests/integration/    # 40 Auth, JWT, API Key & Webhook tests
pytest tests/unit/           # 17 Schema & Tool registry tests
pytest tests/routing/        # 33 Router, Evals & Arena tests
```

| Category | Domain | Tests | Status |
| :--- | :--- | :---: | :---: |
| **Cat 1** | Authentication & Password Security (PBKDF2, Salting, Constant-Time Comparison) | 10 | **PASS (10/10)** |
| **Cat 2** | JWT Lifecycle, Claims & Expiration (HS256, Expiry, Tampering Defense) | 10 | **PASS (10/10)** |
| **Cat 3** | API Key Cryptography, Scopes & Lifecycle (SHA-256 Hashing, Prefixes, Entitlements) | 10 | **PASS (10/10)** |
| **Cat 4** | Enterprise Webhooks & HMAC-SHA256 (Replay Window 300s, Timestamps, Signatures) | 10 | **PASS (10/10)** |
| **Cat 5** | SQL Tool & Injection Defense (Read-only SELECT, keyword blocking, stacked queries) | 10 | **PASS (10/10)** |
| **Cat 6** | File System Sandbox & Path Traversal (Null-bytes, ../, root escapes, whitelist) | 10 | **PASS (10/10)** |
| **Cat 7** | Advanced Math AST Sandbox & Security (AST eval, eval/dunder blocking, DoS prevention) | 10 | **PASS (10/10)** |
| **Cat 8** | Multi-Agent DAG Workflow Engine (Kahn's toposort, cycle detection, parallel waves) | 10 | **PASS (10/10)** |
| **Cat 9** | Specialized Agent Personas & Templates (5 roles, system prompt immutability, templates) | 10 | **PASS (10/10)** |
| **Cat 10** | Knowledge Graph & Network Topology (Node/edge storage, graph export, isolated nodes) | 10 | **PASS (10/10)** |
| **Cat 11** | Graph Centrality & AST Code Analysis (PageRank, BFS shortest paths, Python AST) | 10 | **PASS (10/10)** |
| **Cat 12** | Semantic Vector Cache & Similarity Math (Cosine math, exact hits, normalized queries) | 10 | **PASS (10/10)** |
| **Cat 13** | Cache Policies, TTL & Telemetry (24h TTL, LRU eviction, token & cost tracking) | 10 | **PASS (10/10)** |
| **Cat 14** | Hybrid RAG 2.0 & BM25 Sparse Search (Tokenization, TF-IDF scoring, exact matches) | 10 | **PASS (10/10)** |
| **Cat 15** | Reciprocal Rank Fusion & Chunking (RRF rank merging, sliding window chunking) | 10 | **PASS (10/10)** |
| **Cat 16** | LLM-as-a-Judge Evaluation & Heuristics (Faithfulness, Relevance, Hallucination) | 10 | **PASS (10/10)** |
| **Cat 17** | Model Arena, Blind Battles & Telemetry (Sequential VRAM unload, TTFT/TPS metrics) | 10 | **PASS (10/10)** |
| **Cat 18** | Arena Leaderboard, Voting & Win Rates (Blind voting, tie handling, Elo ranking) | 10 | **PASS (10/10)** |
| **Cat 19** | Tool Execution, Dispatcher & Validation (Tool registry, lifecycle, parameter schemas) | 10 | **PASS (10/10)** |
| **Cat 20** | Pydantic Schemas, Model Router & Config (Request validation, CORS, fallback router) | 10 | **PASS (10/10)** |
| **TOTAL** | **Enterprise 200-Test Suite** | **200** | **200 / 200 PASSED (100%)** |

> [!NOTE]
> **Zero-C Compilation**: All cryptography (API keys, Webhook HMAC-SHA256 signatures, PBKDF2, JWT) uses Python's standard library `hashlib`, `hmac`, and `secrets`. This ensures native cross-platform Windows compatibility without GCC or Visual Studio Build Tools.

---

## 📡 Complete REST & SSE Route Reference

### Authentication & Access Control
- `POST /auth/register`: Initiate user registration, validate unique constraints, and dispatch 6-digit OTP code.
- `POST /auth/verify-otp`: Cryptographically verify 6-digit OTP, create user record in database, and return JWT access + refresh tokens.
- `POST /auth/resend-otp`: Rate-limited OTP resend with 60-second cooldown protection.
- `POST /auth/login`: Authenticate with email/password (supports administrators and standard users) and obtain JWT tokens.
- `POST /auth/refresh`: Refresh expired JWT access token using a valid refresh token.
- `GET /auth/me`: Current user profile, role (`admin` / `user`), and custom instructions.
- `GET /auth/api-keys`: List active API keys.
- `POST /auth/api-keys`: Create scoped API key (returns raw key once).
- `DELETE /auth/api-keys/{key_id}`: Revoke an API key.

### Core Chat & Memory
- `POST /chat`: Synchronous execution with intent classification, memory, and `effort_level` (`low`, `medium`, `high`).
- `POST /chat/stream`: Real-time SSE token stream with latency tracking, inline tool/agent events, and dynamic effort iteration budgeting.
- `POST /chat/{session_id}/messages`: Append messages (e.g. completed workflow deliverables or user notes) to conversation history.
- `POST /chat/regenerate`: Retry last assistant response.
- `GET /conversations`: List paginated conversation threads.
- `GET /chat/{session_id}/messages`: Message history for a specific conversation.
- `DELETE /conversations/{session_id}`: Delete conversation and associated memory summaries.

### Multi-Agent Workflows & Operations
- `GET /agents/roles`: List available autonomous personas.
- `GET /agents/templates`: Pre-built DAG workflow templates.
- `POST /agents/workflows/run`: Execute a multi-agent DAG workflow with real-time SSE stream.
- `POST /agents/roles/chat`: Single-turn interaction with an isolated agent role.
- `GET /agents/runs`: List historical workflow runs with node outputs and timings.
- `GET /agents/runs/{run_id}`: Detailed trace of a specific past execution.
- `POST /agents/runs`: Save or persist a completed workflow run.
- `DELETE /agents/runs/{run_id}`: Delete a saved workflow run.

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
JWT_SECRET=dev-secret-key-replace-in-production-32-chars-min
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# OTP & Email Verification Configuration
OTP_EXPIRE_MINUTES=10
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_ATTEMPTS=5

# SMTP Email Configuration (Optional - falls back to dev terminal banner if empty)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=AI Orchestrator
SMTP_TLS=true
```

### 3. Initialize Database Schema
```bash
python -m app.database.init_db
```

### 4. Start the Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
