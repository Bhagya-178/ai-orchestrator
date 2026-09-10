# 📖 AI Orchestrator Enterprise — Complete User & Architecture Guide

> A comprehensive, end-to-end user and developer manual for **AI Orchestrator Enterprise**: an advanced local AI orchestration platform featuring Claude/ChatGPT parity, ReAct agent coding loops, Multi-Agent DAG workflows, Canvas Studio 2.0, Hybrid RAG 2.0, Entity Knowledge Graphs, Semantic Vector Caching, Model Arena, and an Enterprise Developer Platform.

---

## 📑 Table of Contents
1. [Platform Overview & Mental Model](#1-platform-overview--mental-model)
2. [Quickstart & Native Windows Setup (No Docker)](#2-quickstart--native-windows-setup-no-docker)
3. [Core Chat Experience & Controls](#3-core-chat-experience--controls)
4. [The Agentic Coding Loop (ReAct) Deep-Dive](#4-the-agentic-coding-loop-react-deep-dive)
5. [Canvas Studio 2.0 (Artifacts Parity)](#5-canvas-studio-20-artifacts-parity)
6. [Multi-Agent DAG Workflow Engine](#6-multi-agent-dag-workflow-engine)
7. [Model Arena: Blind A/B Battles & Benchmarks](#7-model-arena-blind-ab-battles--benchmarks)
8. [Hybrid RAG 2.0 & Entity Knowledge Graph](#8-hybrid-rag-20--entity-knowledge-graph)
9. [Semantic Vector Caching Layer](#9-semantic-vector-caching-layer)
10. [LLM-as-a-Judge Evaluation Studio](#10-llm-as-a-judge-evaluation-studio)
11. [Developer Platform: API Keys & Webhooks](#11-developer-platform-api-keys--webhooks)
12. [The 200-Test Enterprise Verification Suite](#12-the-200-test-enterprise-verification-suite)
13. [Troubleshooting & Frequently Asked Questions](#13-troubleshooting--frequently-asked-questions)

---

## 1. Platform Overview & Mental Model

### Orchestrator vs. "Dumb Chat"
Traditional AI chat interfaces send a user's prompt directly to a single Large Language Model (LLM) and stream back raw text tokens. While adequate for basic questions, this approach falls short for real-world engineering, multi-step research, enterprise security, and accurate information retrieval.

**AI Orchestrator** functions as a deterministic AI operating system:
- **Intent Classification & Routing**: Analyzes every incoming prompt before generation begins, determining whether the query requires deep coding, multi-step reasoning, RAG context retrieval, mathematical calculation, or general conversation.
- **Sandboxed Tool Execution**: Evaluates whether the model needs external capabilities (calculating mathematical expressions, inspecting directories, querying SQL databases, or fetching web data) and executes them within secure, sandboxed environments.
- **Verification & Grounding**: Fuses dense vector embeddings with lexical BM25 search and entity graph relationships to prevent hallucination.
- **Privacy & Sovereignty**: Runs 100% locally with private models via Ollama, local PostgreSQL, and Qdrant vector storage. Zero data leaves your machine.

```mermaid
graph TD
    UserPrompt["User Prompt"] --> Classifier{"Intent Classifier"}
    Classifier -->|Coding / Tools| ReActLoop["ReAct Coding Loop (Tools, AST, SQL)"]
    Classifier -->|Research / Q&A| HybridRAG["Hybrid RAG 2.0 (Dense + BM25 + KG)"]
    Classifier -->|Cached Query| CacheHit["Semantic Cache (< 2ms Hit)"]
    Classifier -->|Multi-Role Task| DAGRunner["Multi-Agent DAG Engine (5 Roles)"]
    ReActLoop --> CanvasStudio["Canvas Studio 2.0 (Live Preview, Editor, Diff)"]
    HybridRAG --> SynthesizedResponse["Grounded Response + Citations"]
    DAGRunner --> MultiAgentArtifacts["Topological Workflow Output"]
```

### Guest Mode vs. Registered Multi-Tenant Mode
The platform supports two user operating tiers:

| Feature | Guest User Mode | Registered User Mode |
| :--- | :--- | :--- |
| **Authentication** | None required (Instant access) | Argon2id/PBKDF2 passwords + JWT tokens |
| **Turn Limit** | 5 free conversational turns | Unlimited turns |
| **Data Storage** | Local browser session only | Isolated PostgreSQL database schemas |
| **Multi-Tenant Workspaces**| Not available | Full RBAC (`owner`, `admin`, `member`, `viewer`) |
| **Developer Tools** | Disabled | Programmatic API keys & HMAC webhooks |
| **Artifact History** | Session lifetime | Permanent revision history & diff comparisons |

When the 5-turn guest limit is reached, an interactive **Guest Limit Modal** prompts the user to create an account or sign in. All active session history seamlessly migrates into the newly registered user profile without losing state.

---

## 2. Quickstart & Native Windows Setup (No Docker)

AI Orchestrator is designed to run natively on Windows without requiring Docker containers or Linux virtual machines.

### Prerequisites
1. **Python 3.11+**: With standard pip installer.
2. **Node.js 18+** (v20+ LTS recommended): For Next.js 16 with Turbopack.
3. **Ollama**: Download and install from [ollama.com](https://ollama.com).
4. **PostgreSQL 15+**: Running locally on `localhost:5432`.
5. **Qdrant Vector Database**: Running on `localhost:6333` (native binary or standalone service).

### Recommended Ollama Models
Open PowerShell and download the recommended model suite:
```powershell
# Primary general & reasoning model
ollama pull qwen3:8b

# Specialized coding model
ollama pull qwen2.5-coder:7b

# Lightweight fast-response model
ollama pull qwen2.5:1.5b

# Deep reasoning model
ollama pull deepseek-r1:8b

# Embedding model for RAG & Semantic Cache
ollama pull bge-m3
```

### Step 1: Backend Setup
```powershell
cd e:\Project\ai-orchestrator\backend

# Create and activate Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies (zero-C compilation, fully pure-Python compatible)
pip install -r requirements.txt

# Configure environment variables (.env)
Copy-Item .env.example .env
```

Ensure your `.env` contains:
```ini
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ai_orchestrator
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=documents
OLLAMA_BASE_URL=http://localhost:11434
SECRET_KEY=your-super-secret-hex-key-minimum-32-characters
DEFAULT_MODEL=qwen3:8b
CODER_MODEL=qwen2.5-coder:7b
EMBEDDING_MODEL=bge-m3
OLLAMA_KEEP_ALIVE=0m
```

Launch the FastAPI backend:
```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The API interactive documentation will be available at `http://localhost:8000/docs`.

### Step 2: Frontend Setup
In a second PowerShell window:
```powershell
cd e:\Project\ai-orchestrator\frontend

# Install node dependencies
npm install

# Verify environment file (.env.local)
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Start Turbopack development server
npm run dev
```
Open your browser to `http://localhost:3000`.

---

## 3. Core Chat Experience & Controls

The chat interface is modeled after the state-of-the-art experiences of Claude and ChatGPT, offering clean, distraction-free interactions alongside powerful developer tools.

```
+-----------------------------------------------------------------------------------+
|  [☰ Conversations]   AI Orchestrator Enterprise          [Studio & Tools ▾] [User]|
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  User: "Write an interactive React counter with increment and reset."             |
|                                                                                   |
|  Assistant:                                                                       |
|  [⚙ Tool Call: file_system.write_file ("counter.tsx")]  [Execution: 12ms] [PASS]   |
|                                                                                   |
|  Here is the interactive React counter widget. I have opened it in Canvas Studio: |
|  +-----------------------------------------------------------------------------+  |
|  | 📦 Artifact: Interactive Counter Component                     [Open Canvas]|  |
|  +-----------------------------------------------------------------------------+  |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  [📎 attachment.pdf] [High Effort ▾] [Auto Intent ▾]                              |
|  [ Message AI Orchestrator...                                    ] [🎤] [▶ Send]  |
+-----------------------------------------------------------------------------------+
```

### Effort Levels (`low`, `medium`, `high`)
Located at the bottom left of the chat composer:
- **Low Effort**: Fast, single-turn responses with concise explanations. Best for simple queries, quick translations, and basic syntax lookups. Minimal tool-calling overhead.
- **Medium Effort (Default)**: Balanced reasoning. Inspects context, evaluates edge cases, and chains tools when necessary.
- **High Effort**: Full deep-thinking mode. Expands ReAct tool execution iterations up to 10 rounds, activates AST code parsing, pulls relational knowledge graph connections, and enforces comprehensive error handling.

### Intent Overrides & Model Selection
By default, the **Auto Intent** classifier detects prompt intent and dynamically routes the request to the optimal model:
- `coding` $\to$ Dispatches to `qwen2.5-coder:7b` with code-specific system prompts.
- `reasoning` $\to$ Dispatches to `deepseek-r1:8b` with extended reasoning parameters.
- `study` $\to$ Dispatches to `qwen3:8b` with pedagogical decomposition.
- `general` $\to$ Dispatches to `qwen3:8b` for rapid conversational responses.

You can explicitly override this by clicking the **Intent Selector** in the composer to force a specific intent, or by targeting an Ollama model directly using tags (e.g. `@qwen2.5-coder:7b`).

### Document Context Pill & RAG Toggle
When you upload a file (PDF, DOCX, TXT):
1. The file appears as an interactive **attachment pill** above the input box.
2. Clicking the **x** on the pill detaches the document.
3. Clicking the pill toggles between **RAG Enabled** (vector retrieval will query document chunks) and **Direct Chat** (the document is kept in session memory without active vector augmentation).

### Prompt History Navigation (`↑` and `↓`)
Like modern terminal shells and premier AI interfaces:
- Press **Up Arrow (`↑`)** when the composer is empty to cycle through your previous prompts.
- Press **Down Arrow (`↓`)** to cycle back toward your latest message.
- History is saved to browser storage and seeded from your PostgreSQL conversation history.

### Message Branching & In-Place Editing
Hovering over any previous user message displays the **Edit** pencil icon:
- Editing a message forks the conversation from that exact turn.
- A branching indicator (`< 1 / 2 >`) allows you to switch between alternative conversational paths without losing prior reasoning or generated artifacts.

---

## 4. The Agentic Coding Loop (ReAct) Deep-Dive

The ReAct (Reasoning + Acting) coding loop transforms the AI from a passive text generator into an active, autonomous software engineer capable of exploring codebases, testing hypotheses, and correcting its own errors.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Orchestrator as Chat Pipeline
    participant Router as Tool Router
    participant Sandbox as Tool Sandbox (AST/SQL/FS)
    participant LLM as Ollama Model (qwen2.5-coder)
    participant UI as Chat & Canvas UI

    User->>Orchestrator: "Audit database schema and compute average user order total"
    Orchestrator->>LLM: User Prompt + Tool Schemas + System Prompt
    Note over LLM: Step 1: Thought & Tool Call Generation
    LLM-->>Orchestrator: Thought: "I need to inspect tables first." <br/>Call: sql_query("SELECT table_name FROM information_schema.tables")
    Orchestrator->>UI: SSE Event: tool_call_started
    Orchestrator->>Router: Dispatch sql_query
    Router->>Sandbox: Execute read-only AST-validated SELECT
    Sandbox-->>Router: Result: ['users', 'orders', 'order_items']
    Router-->>Orchestrator: Observation returned
    Orchestrator->>UI: SSE Event: tool_call_completed (Result, Timing: 14ms)
    
    Note over LLM: Step 2: Chained Reasoning & Acting
    Orchestrator->>LLM: Prompt + Prior History + Tool Observation
    LLM-->>Orchestrator: Thought: "Now calculating average order total." <br/>Call: sql_query("SELECT AVG(total) FROM orders")
    Orchestrator->>Router: Dispatch sql_query
    Router->>Sandbox: Execute query
    Sandbox-->>Router: Result: $142.50
    Router-->>Orchestrator: Observation returned
    
    Note over LLM: Step 3: Final Synthesis
    Orchestrator->>LLM: Prompt + Observations
    LLM-->>Orchestrator: Final Answer: "The average order total across all users is $142.50."
    Orchestrator->>UI: Stream final text tokens to ChatView
```

### Complete Built-In Tool Catalog

| Tool Name | Identifier | Purpose | Security Sandbox Enforcement |
| :--- | :--- | :--- | :--- |
| **Advanced Math AST** | `math_eval` | Evaluates complex mathematical & scientific expressions (`sin`, `cos`, `log`, `sqrt`, `factorial`). | AST-parsed. Strictly blocks `eval()`, `exec()`, `__import__`, builtins, and dunder attribute access. |
| **SQL Query Tool** | `sql_query` | Queries relational databases for exploratory analysis and reporting. | AST-enforced read-only `SELECT`. Blocks `DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, `TRUNCATE`, and stacked statements (`;`). |
| **File System Sandbox** | `file_system` | Reads, writes, and lists files within the project workspace. | Path traversal guard blocks `../`, `..\`, absolute root escapes, and null-byte (`\x00`) injections. Size capped at 10MB. |
| **Calculator** | `calculator` | Rapid basic arithmetic (`+`, `-`, `*`, `/`, `^`, `%`). | Safe tokenization with zero access to system calls. |
| **DateTime Tool** | `datetime` | Fetches current UTC/local timestamps and computes offsets. | Deterministic, non-blocking time resolution. |
| **Web Scraper & Search** | `web_search` | Fetches live documentation and external web content. | Rate-limited HTTP client with HTML-to-text sanitization. |
| **Chart Generator** | `chart_generator`| Emits declarative Chart.js configurations (Bar, Line, Pie, Radar). | JSON schema validation rendered directly in Canvas Studio. |
| **Model Context Protocol** | `mcp_hub` | Dynamic bridge to external tool servers over `stdio` and `sse`. | Conforms to official JSON-RPC 2.0 MCP standards. |

### Real-Time Frontend Telemetry: `ToolExecutionCard.tsx`
Every tool invocation emits Server-Sent Events (SSE) that render inside the message bubble:
- **Status Indicator**: Animated spinner during execution $\to$ Green checkmark (`[PASS]`) or Amber alert (`[BLOCKED]`).
- **Timing Badge**: Shows wall-clock execution latency (e.g. `14.2ms`).
- **Expandable Inspector**: Clicking the card reveals the exact input parameters and the formatted output observation.

---

## 5. Canvas Studio 2.0 (Artifacts Parity)

Canvas Studio 2.0 delivers full Claude Artifacts parity directly on your local workstation. When the agent generates self-contained code, interactive UI components, SVG graphics, or Mermaid diagrams, it encapsulates them in an Artifact.

```
+-----------------------------------------------------------------------------------+
|  Canvas Studio 2.0: Interactive Counter Widget                [⟲ Reset] [⤢ Full] [✕]|
+-----------------------------------------------------------------------------------+
|  [ Preview ]      [ Code Editor ]      [ Console (1) ]      [ Diff (v1 vs v2) ]   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|    +-------------------------------------------------------------------------+    |
|    |                                                                         |    |
|    |                        Current Count: 42                                |    |
|    |                                                                         |    |
|    |             [ - Decrement ]     [ + Increment ]     [ Reset ]           |    |
|    |                                                                         |    |
|    +-------------------------------------------------------------------------+    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  Console: [LOG] Counter component mounted successfully (index.tsx:12)            |
+-----------------------------------------------------------------------------------+
```

### Multi-Tab Workspace Capabilities
1. **Preview Tab**: 
   - An isolated, sandboxed iframe executing HTML, CSS, JavaScript, and Tailwind CSS.
   - Built-in error boundary catching runtime JavaScript exceptions.
2. **Code Editor Tab**:
   - Syntax-highlighted code viewer with line numbers and one-click clipboard copying.
   - Allows direct in-place edits to artifact code.
3. **Console Tab**:
   - Features a bidirectional `window.postMessage` bridge capturing `console.log`, `console.info`, `console.warn`, and `console.error` directly from the running iframe.
   - Displays line numbers and structured object inspection.
4. **Diff Tab**:
   - Visual line-by-line diff comparison comparing original artifact generation against updated revisions.
   - Red highlights indicate removed lines; green highlights indicate added lines.

### Interactive Diagram Controls (SVG & Mermaid)
When rendering architectural diagrams or flowcharts:
- **Pan & Zoom**: Click and drag to pan across large architecture graphs; use the mouse scroll-wheel to zoom from 10% to 500%.
- **Reset View**: Instantly centers and fits the diagram to the viewport.
- **Export**: One-click download as SVG or PNG.

---

## 6. Multi-Agent DAG Workflow Engine

For multi-stage projects that exceed the capacity of a single prompt, AI Orchestrator features a Directed Acyclic Graph (DAG) orchestration engine based on **Kahn's Topological Sort Algorithm**.

```mermaid
graph LR
    P[PlannerAgent<br/><i>Architecture Blueprint</i>] --> R[ResearcherAgent<br/><i>API Specs & Libraries</i>]
    P --> C[CoderAgent<br/><i>Implementation Code</i>]
    R --> C
    C --> Rev[ReviewerAgent<br/><i>Security & Edge Cases</i>]
    Rev --> Crit[CriticAgent<br/><i>Final Synthesis & Scoring</i>]
```

### The 5 Specialized Autonomous Personas
1. **`PlannerAgent`**: High-level architect. Decomposes ambiguous business requirements into discrete technical milestones and specifies contracts.
2. **`ResearcherAgent`**: Grounded fact extractor. Queries hybrid RAG, local files, and web search to retrieve exact library versions, schemas, and constraints.
3. **`CoderAgent`**: Production software engineer. Writes strictly typed, PEP8/TypeScript-compliant code with complete error handling.
4. **`ReviewerAgent`**: Security and quality auditor. Scans code for injection vulnerabilities, memory leaks, missing boundary conditions, and performance bottlenecks.
5. **`CriticAgent`**: Lead evaluator. Synthesizes inputs from all prior agents, verifies that the original specification was met, and assigns a completion confidence score (0–100%).

### Built-In DAG Templates
- **Full-Stack Application Generation**: Decomposes a feature into database schema $\to$ FastAPI REST endpoint $\to$ React frontend component $\to$ integration tests.
- **Fact-Checking & Research Synthesis**: Gathers multi-source evidence, cross-checks assertions, identifies conflicting claims, and outputs an executive summary.
- **Vulnerability & Security Audit**: Audits code for OWASP Top 10 vulnerabilities, evaluates AST safety, and outputs remediation patches.

### Execution & Real-Time SSE Telemetry
Workflows execute in parallel waves where independent nodes run concurrently. Access the interactive DAG builder via **Studio & Tools ▾ $\to$ Multi-Agent DAG Studio**. Real-time SSE updates stream node state transitions (`pending` $\to$ `running` $\to$ `completed`) and agent thoughts.

---

## 7. Model Arena: Blind A/B Battles & Benchmarks

The Model Arena lets you empirically compare local LLMs through blind, side-by-side evaluations.

```
+-----------------------------------------------------------------------------------+
|  Model Arena: Blind A/B Evaluation                                                |
+-----------------------------------------------------------------------------------+
|  Prompt: "Implement a thread-safe LRU Cache in Python with O(1) operations."      |
|                                                                                   |
|  [ Model Alpha (Streaming...) ]              [ Model Beta (Streaming...) ]        |
|  Time to First Token: 210ms                  Time to First Token: 480ms           |
|  Generation Speed: 48.2 tok/s                Generation Speed: 29.1 tok/s         |
|  +-------------------------------------+     +----------------------------------+ |
|  | class LRUCache:                     |     | from collections import ...      | |
|  |     def __init__(self, capacity):   |     | class Node:                      | |
|  |         self.cap = capacity         |     |     def __init__(self, k, v):    | |
|  |         ...                         |     |         ...                      | |
|  +-------------------------------------+     +----------------------------------+ |
|                                                                                   |
|                 [ Vote Model Alpha ]  [ Vote Model Beta ]  [ Tie ]                |
+-----------------------------------------------------------------------------------+
```

### Single-GPU Sequential Execution (`keep_alive: 0m`)
Running two modern 7B or 8B parameter models simultaneously typically requires 16GB–24GB of VRAM. AI Orchestrator supports consumer hardware with single 8GB/12GB GPUs through automatic sequential execution:
1. `Model A` streams its response to completion.
2. Ollama is instructed with `keep_alive: 0m`, immediately unloading `Model A` from GPU VRAM.
3. `Model B` is loaded into VRAM and streams its response.
4. Telemetry records true independent Time-to-First-Token (TTFT) and Tokens-per-Second (TPS) for both models.

### Blind Voting & Live Elo Leaderboard
- Model identities are masked during generation (`Model Alpha` vs `Model Beta`).
- Users cast blind votes: **Model A Better**, **Model B Better**, or **Tie**.
- Once a vote is submitted, the model identities are revealed (e.g. `qwen2.5-coder:7b` vs `deepseek-r1:8b`).
- The persistent Leaderboard recalculates win-rates, total matches, and throughput statistics.

---

## 8. Hybrid RAG 2.0 & Entity Knowledge Graph

AI Orchestrator implements a multi-stage retrieval pipeline combining dense semantic vector search, sparse keyword search, and structural knowledge graph traversal.

```mermaid
graph TD
    Query["User Query"] --> DenseBranch["Dense Vector Retrieval (bge-m3 + Qdrant)"]
    Query --> SparseBranch["Sparse Lexical Retrieval (BM25Okapi)"]
    Query --> KGBranch["Knowledge Graph Subgraph (PageRank & AST)"]
    
    DenseBranch --> RRF["Reciprocal Rank Fusion (RRF)"]
    SparseBranch --> RRF
    
    RRF --> ReRankedChunks["Top Ranked Context Chunks"]
    KGBranch --> GraphContext["Structural Entity Context"]
    
    ReRankedChunks --> PromptSynthesizer["Prompt Synthesizer"]
    GraphContext --> PromptSynthesizer
    PromptSynthesizer --> FinalPrompt["Context-Augmented Prompt to LLM"]
```

### Reciprocal Rank Fusion (RRF)
Dense embeddings capture broad semantic concepts, while BM25 captures precise keyword matches (e.g., function names, error codes, UUIDs). RRF fuses their rankings mathematically:

$$RRF(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$

where $M = \{\text{dense}, \text{sparse}\}$ and $r_m(d)$ is the document's rank in system $m$.

### Entity Knowledge Graph
When codebases or documents are ingested:
1. **Python/TypeScript AST Parsers**: Extract classes, methods, functions, and import statements.
2. **Relationships**: Mapped as directed edges: `inherits`, `defines`, `imports`, and `calls`.
3. **PageRank Centrality**: Evaluates node importance to identify core architectural modules versus leaf utilities.
4. **Shortest Path Analysis**: Dijkstra and BFS pathfinding discovers how two distant modules communicate.
5. **Interactive 2D Visualizer**: Explore nodes, inspect degrees of centrality, and view connected subgraphs under **Studio & Tools ▾ $\to$ Knowledge Graph Visualizer**.

---

## 9. Semantic Vector Caching Layer

To eliminate redundant LLM compute and achieve sub-millisecond response times, the orchestrator incorporates a dual-layer semantic caching architecture:

```
User Query
    │
    ▼
[Exact Hash Match (MD5/SHA-256)] ──Hit (< 1ms)──► Return Cached Response
    │
    │ Miss
    ▼
[Vector Cosine Similarity (≥ 0.92)] ──Hit (< 2ms)──► Return Cached Response
    │
    │ Miss
    ▼
[Dispatch to LLM / Agent Pipeline] ───► Compute & Write to Semantic Cache
```

### Cosine Similarity Threshold
When a user asks `"How do I configure Postgres connection pooling?"` and later asks `"How to setup PostgreSQL connection pool?"`:
- The exact hash misses.
- Query embeddings are compared via Cosine Similarity:
  $$\text{sim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}$$
- Because $\text{sim} \ge 0.92$, a **Semantic Cache Hit** occurs, delivering the response in $< 2\text{ms}$ with zero GPU compute.

### Cache Eviction & Telemetry
- **24-Hour Time-to-Live (TTL)**: Outdated responses automatically expire.
- **LRU Eviction**: Caps memory usage by purging least-recently-used entries.
- **Telemetry Dashboard**: Tracks total prompt tokens saved, completion tokens saved, and estimated compute cost savings.

---

## 10. LLM-as-a-Judge Evaluation Studio

The Evaluation Studio allows you to test model quality, measure alignment, and detect hallucinations automatically.

### Quantitative Metrics
1. **Faithfulness Score (0.0 to 1.0)**:
   - Measures the proportion of claims in the generated answer that are directly grounded in the retrieved RAG context chunks.
   - Low faithfulness indicates hallucination.
2. **Answer Relevance Score (0.0 to 1.0)**:
   - Computes the semantic overlap and intent satisfaction between the original user prompt and the generated reply.
3. **Hallucination Index**:
   - Inverse of faithfulness: $1.0 - \text{Faithfulness}$. Directly exposes unsupported assertions.

### Benchmark Datasets
Run evaluations against curated test suites:
- `coding_standard`: 20 unit testing, recursion, and algorithm problems.
- `reasoning_logic`: Multi-step syllogisms, constraint logic, and deduction puzzles.
- `rag_faithfulness`: Factual passage question answering with ground-truth facts.

Results are summarized in a visual **Radar Metric Chart** inside **Studio & Tools ▾ $\to$ Evals Dashboard**.

---

## 11. Developer Platform: API Keys & Webhooks

Integrate AI Orchestrator into your external scripts, CI/CD pipelines, and internal tools using the developer platform.

### Programmatic API Keys
- Keys follow industry-standard prefixes:
  - `ak_live_...` for production environments.
  - `ak_test_...` for testing environments.
- **High Entropy**: Generated via `secrets.token_urlsafe(32)` (256 bits of cryptographic entropy).
- **One-Way Storage**: Raw keys are shown only once upon generation. The database stores only the SHA-256 hash.
- **Granular Scopes**:
  - `chat:read`, `chat:write`: Send messages and stream completions.
  - `rag:admin`: Ingest, list, and delete vector documents.
  - `agents:run`: Launch multi-agent DAG workflows.
  - `*`: Global superuser wildcard scope.

#### Using API Keys with `curl`
```bash
curl -X POST http://localhost:8000/chat \
  -H "Authorization: Bearer ak_live_3f9a7b2c..." \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Calculate prime numbers up to 100",
    "effort": "medium"
  }'
```

### HMAC-SHA256 Signed Webhooks
Subscribe external services to platform events (`chat.completed`, `workflow.node_finished`, `artifact.created`, `eval.finished`).

#### Webhook Security Headers
Every webhook payload includes:
- `X-Orchestrator-Signature`: Contains timestamp `t` and signature `v1`:
  ```
  t=1725800000,v1=9b2d8e4f1a3c5e7b...
  ```
- **Replay Protection**: Deliveries with timestamps differing by more than 300 seconds are rejected.

#### Webhook Signature Verification Example (Python)
```python
import hmac
import hashlib
import time

def verify_orchestrator_webhook(payload_bytes: bytes, header: str, secret: str) -> bool:
    # 1. Parse header
    parts = dict(item.split("=") for item in header.split(","))
    timestamp = int(parts["t"])
    expected_sig = parts["v1"]
    
    # 2. Check replay attack window (300 seconds)
    if abs(time.time() - timestamp) > 300:
        return False
        
    # 3. Compute HMAC-SHA256 signature
    signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
    computed_sig = hmac.new(
        secret.encode("utf-8"),
        signed_payload,
        hashlib.sha256
    ).hexdigest()
    
    # 4. Constant-time comparison
    return hmac.compare_digest(computed_sig, expected_sig)
```

---

## 12. The 200-Test Enterprise Verification Suite

Every subsystem, cryptographic primitive, security boundary, and agent workflow is validated by an automated **200-test verification suite** (`backend/scratch/test_complete_suite_200.py`).

### Running the Complete Suite
```powershell
python backend/scratch/test_complete_suite_200.py
```

### Category Breakdown (20 Categories $\times$ 10 Tests Each = 200 Tests)

```
================================================================================
200-TEST SUITE EXECUTION SCORECARD
================================================================================
Category Domain                                    | Passed   | Failed  
------------------------------------------------------------------------
Cat 1: Authentication & Password Security          | 10       | 0       
Cat 2: JWT Lifecycle & Claims                      | 10       | 0       
Cat 3: API Key Cryptography & Scopes               | 10       | 0       
Cat 4: Enterprise Webhooks & HMAC                  | 10       | 0       
Cat 5: SQL Tool & Injection Defense                | 10       | 0       
Cat 6: File System Sandbox & Path Traversal        | 10       | 0       
Cat 7: Advanced Math AST Sandbox & Security        | 10       | 0       
Cat 8: Multi-Agent DAG Workflow Engine             | 10       | 0       
Cat 9: Specialized Agent Personas & Templates      | 10       | 0       
Cat 10: Knowledge Graph & Network Topology         | 10       | 0       
Cat 11: Graph Centrality & AST Code Analysis       | 10       | 0       
Cat 12: Semantic Vector Cache & Similarity Math    | 10       | 0       
Cat 13: Cache Policies, TTL & Telemetry            | 10       | 0       
Cat 14: Hybrid RAG 2.0 & BM25 Sparse Search        | 10       | 0       
Cat 15: Reciprocal Rank Fusion & Chunking          | 10       | 0       
Cat 16: LLM-as-a-Judge Evaluation & Heuristics     | 10       | 0       
Cat 17: Model Arena, Blind Battles & Telemetry     | 10       | 0       
Cat 18: Arena Leaderboard, Voting & Win Rates      | 10       | 0       
Cat 19: Tool Execution, Dispatcher & Validation    | 10       | 0       
Cat 20: Pydantic Schemas, Model Router & Config    | 10       | 0       
------------------------------------------------------------------------
TOTAL SUMMARY                                      | 200      | 0       
Total Execution Time: ~2.8 seconds
================================================================================
[SUCCESS] ALL 200 / 200 TESTS PASSED (100% SUCCESS RATE)!
```

---

## 13. Troubleshooting & Frequently Asked Questions

### 1. "Ollama connection refused at localhost:11434"
- Verify Ollama is running: open PowerShell and type `ollama list`.
- If the service is stopped, run `ollama serve`.
- Ensure `OLLAMA_BASE_URL=http://localhost:11434` in your backend `.env`.

### 2. "Model not found: qwen2.5-coder:7b"
- Pull the missing model: `ollama pull qwen2.5-coder:7b`.
- Check available models in the backend health endpoint: `http://localhost:8000/health`.

### 3. Out of Memory (OOM) on Local GPU during Battles
- Ensure `OLLAMA_KEEP_ALIVE=0m` in your `.env`.
- In Model Arena, ensure the **Sequential Mode** toggle is enabled. This forces Model A to completely unload from VRAM before Model B loads, allowing smooth battles even on 8GB VRAM cards.

### 4. Document context not appearing in LLM response
- Ensure the document status indicator shows `Ready` (green) on the attachment pill.
- Verify that the attachment pill is active (not grayed out).
- Verify Qdrant is running on `http://localhost:6333`.

### 5. PostgreSQL Database Migration
- If running for the first time, tables auto-create via SQLAlchemy ORM models during FastAPI lifespan startup.
- Ensure the PostgreSQL role and database specified in `DATABASE_URL` exist before starting the server:
  ```sql
  CREATE DATABASE ai_orchestrator;
  ```

---

<div align="center">
  <b>AI Orchestrator Enterprise</b> — Engineered for Privacy, Performance, and Autonomous Engineering.
</div>
