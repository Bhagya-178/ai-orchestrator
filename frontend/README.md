# 🎨 AI Orchestrator Frontend UI

A production-grade, minimalist AI operating frontend built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **Turbopack**.

Designed with **Claude and ChatGPT parity**, the frontend provides a distraction-free conversation canvas while seamlessly housing enterprise power tools: interactive multi-tab artifacts (Canvas Studio 2.0), real-time ReAct tool execution telemetry, 2D entity knowledge graph exploration, multi-agent DAG workflow orchestration, and a developer platform for API keys and webhooks.

> [!TIP]
> **Complete User & Architecture Manual**: Refer to [**`../GUIDE.md`**](../GUIDE.md) for full documentation on using the chat interface, ReAct tool executions, Canvas Studio 2.0, Model Arena, and native Windows setup.

---

## ⚡ Core UI Capabilities

### 1. Minimalist Claude/ChatGPT Chat Feed & ReAct Telemetry
- **Distraction-Free Chat**: Clean, uncluttered layout with responsive typography, smooth auto-scrolling with floating "scroll-to-bottom" pill, and empty-state starter prompts.
- **Dynamic Effort Selector (`ChatComposer.tsx`)**:
  - `⚡ Low (Fast · 2 iters)`: Quick single-action turn or pruned 2-agent swarm with full context window returning complete deliverables without truncation.
  - `⚖️ Medium (5 iters)`: Standard 3–5 step plan-action-observe loop or full 5-agent sequential DAG with full context window.
  - `🧠 High (10 iters + Reflection)`: Deep multi-tool execution chains or 7-iteration DAG with 2 self-healing reflection loops and full context window.
  - Passes dynamic effort state through `ChatContext` to `/chat/stream` with live reasoning budget telemetry.
- **Immediate Live Swarm Token Streaming**:
  - Emits the workflow header immediately at $t = 0$.
  - As each agent finishes, its output instantly streams into the chat message as markdown tokens, delivering continuous real-time progress every 6–12 seconds without UI freeze.
- **Inline Multi-Agent Swarm Stepper (`AgentSwarmCard.tsx`)**: Big-Tech style in-chat collaboration stepper showing the 5-agent team (Architect $\rightarrow$ Researcher $\rightarrow$ Lead Coder $\rightarrow$ Security Auditor $\rightarrow$ Synthesis Critic) with real-time status badges, duration in ms, and expandable reasoning accordions to inspect intermediate agent outputs.
- **Quick `⚡ Swarm` Toggle**: 1-click button in the composer toolbar to execute full-stack multi-agent swarms without manual DAG configuration.
- **Inline ReAct & Agent Swarm Cards (`ToolExecutionCard.tsx`)**: Invocations of external tools and swarm agent roles stream directly into the conversation turn with dedicated `Bot` icons, role badges (`Agent: <role>`), execution timings, collapsible parameter/result inspectors, and error handling.
- **Prompt History Navigation**: Up and Down arrow key history traversal (persisted to localStorage and pre-seeded from database) allowing seamless prompt recall just like modern AI interfaces.
- **Interactive Message Controls**: In-place prompt editing with branching, message regeneration, and clipboard copy with fallback.
- **Document Context Pill**: Non-intrusive attachment pill for PDF, DOCX, and TXT files with one-click context toggling and status indicators.

### 2. Dual-Theme Liquid Glass Refraction System & Bespoke Wallpapers
- **Optical Glass Refraction**: Custom-engineered `.liquid-glass`, `.liquid-glass-card`, `.liquid-glass-pill`, and `.liquid-glass-modal` CSS classes delivering 40px backdrop blur, saturation boosts, specular highlights, and inner caustics across messages, sidebars, and studio windows.
- **Bespoke Light & Dark Optical Wallpapers**:
  - *☀️ Light Mode (`/ambient-light.jpg`)*: Minimalist Apple-inspired pristine liquid glass caustics with ethereal pastel refraction curves (iridescent soft cyan, sky blue, and lavender) illuminated with soft studio light.
  - *🌙 Dark Mode (`/ambient-dark.jpg`)*: Deep obsidian graphite wallpaper with glowing sapphire, celestial violet, and cybernetic emerald fluid ribbons featuring specular optical edge refractions.
- **Theme-Aware Seamless Transition**: [`AmbientBackground.tsx`](file:///e:/Project/ai-orchestrator/frontend/app/components/layout/AmbientBackground.tsx) detects active light/dark mode and smoothly crossfades between the two dedicated wallpapers with smooth 700ms opacity transitions and radial depth vignettes.

### 3. Interactive Arcade Mini-Games Hub (Zero-Lag Generation Distraction)
When generating long-form code or complex multi-agent swarms, users can choose between **"🎮 Play Games"** and **"⏳ Just Wait"**:
- **5 Pure HTML5 Canvas Arcade Games** (<0.5% CPU, <2MB RAM, 60 FPS, zero external dependencies):
  - *1v1 Cyber Volleyball (`ArcadeVolleyball.tsx`)*: Slime volleyball vs Cyber AI with jump/spike physics and court boundaries.
  - *1v1 Neon Air Hockey (`CyberHockey.tsx`)*: Table hockey vs reactive AI opponent with puck deflection acoustics.
  - *Cyber Snake (`CyberSnake.tsx`)*: Cyberpunk grid snake with progressive difficulty scaling and score multipliers.
  - *Quantum Breakout (`QuantumBreakout.tsx`)*: Neon paddle brick breaker with particle trails and multi-ball dynamics.
  - *Void Runner (`VoidRunner.tsx`)*: Procedural side-scrolling obstacle jumper.
- **Synthesized Web Audio Engine (`arcadeAudio.ts`)**: Pure Web Audio API oscillators for retro sound effects without MP3 network downloads.
- **Answer Ready Banner**: Once model generation completes, users can click **[View Answer]** or **[Keep Playing]** without losing game state.

### 4. 6-Digit Email OTP Verification & Access Control (`AuthModal.tsx`)
- **Seamless Verification Flow**: On registration, the modal transitions to an enterprise 6-digit code verification view.
- **Interactive Input Mechanics**: Auto-focus advancing across 6 individual digit fields, backspace navigation, and smart clipboard paste parsing.
- **Resend Cooldown Timer**: 60-second animated countdown protecting against spam and rate-limit exhaustion.
- **Dev-Mode Quick-Fill Pill**: When running without production SMTP, displays an automatic 1-click badge with the local `dev_otp` for rapid local testing.
- **Admin Support**: Direct authentication support for administrative accounts provisioned securely via environment variables (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### 5. Canvas Studio 2.0 (`app/components/artifacts/`)
Full Claude Artifacts parity for code, interactive web applications, SVGs, and Mermaid diagrams:
- **Multi-Tab Workspace**:
  - `Preview`: Sandboxed iframe with live execution of HTML/CSS/JavaScript and React widgets.
  - `Code Editor`: Syntax-highlighted code editor with copy and edit controls.
  - `Console`: Real-time `postMessage` logging bridge capturing iframe `console.log`, `console.warn`, and `console.error` calls.
  - `Diff`: Visual line-by-line diff comparing original vs edited artifact revisions.
- **Interactive Controls**: Built-in pan, zoom, reset, fullscreen, and download capabilities for SVGs and diagrams.

### 6. Floating Liquid Glass Studio & Tools
All 10+ developer and orchestration studios are rendered inside floating `.liquid-glass-modal` windows:
- **Agents DAG Operations Studio (`AgentWorkflowModal.tsx`)**: Visual Directed Acyclic Graph editor, runs archive, role config, and live execution telemetry.
- **Knowledge Graph Visualizer (`GraphVisualizerModal.tsx`)**: 2D interactive SVG network visualizer with PageRank metrics and entity search.
- **Hybrid RAG 2.0 & Chunks (`KnowledgeBaseModal.tsx`)**: Vector collection management and raw chunk inspector.
- **Model Context Protocol Hub (`McpServerModal.tsx`)**: External MCP STDIO/SSE server connection manager.
- **Model Arena (`ArenaModal.tsx`)**: Side-by-side split battles comparing latency, TTFT, and output quality between models.
- **Evals Dashboard (`EvalsDashboardModal.tsx`)**: LLM-as-a-judge benchmark scorecards measuring faithfulness, relevance, and hallucination rates.
- **Developer Studio (`DeveloperStudioModal.tsx`)**: Scoped API key creation and HMAC-SHA256 webhook subscriptions.
- **Telemetry & Cost Analytics (`AnalyticsModal.tsx`)**: System throughput, token volume forecasting, and host infrastructure telemetry.
- **Workspaces & RBAC (`WorkspaceModal.tsx`)**: Multi-tenant team workspace management with role-based access control.
- **System Settings (`SettingsModal.tsx`)**: Theme preferences, local Ollama models, and BYOK cloud API keys.

---

## 📂 Project Architecture

```text
frontend/
├── public/                    # High-Resolution Optical Liquid Glass Wallpapers
│   ├── ambient-light.jpg      # Apple-style pristine liquid glass caustics (Light Mode)
│   └── ambient-dark.jpg       # Deep obsidian graphite glowing ribbons (Dark Mode)
├── app/
│   ├── components/
│   │   ├── chat/              # Core Chat Experience
│   │   │   ├── ChatComposer.tsx     # Dynamic effort selector, file upload, history navigation
│   │   │   ├── ChatView.tsx         # Message feed, scroll anchors, empty states
│   │   │   └── MessageBubble.tsx    # Markdown, syntax highlighter, inline ReAct cards
│   │   ├── arcade/            # Interactive Arcade Mini-Games Hub (<0.5% CPU)
│   │   │   ├── ArcadeHubModal.tsx   # 5-game launcher, controls & answer-ready banner
│   │   │   ├── ArcadeVolleyball.tsx # 1v1 Slime Volleyball vs AI
│   │   │   ├── CyberHockey.tsx      # 1v1 Neon Air Hockey vs AI
│   │   │   ├── CyberSnake.tsx       # Cyberpunk Grid Snake
│   │   │   ├── QuantumBreakout.tsx  # Neon Paddle Brick Breaker
│   │   │   ├── VoidRunner.tsx       # Procedural Obstacle Jumper
│   │   │   └── arcadeAudio.ts       # Synthesized Web Audio oscillator sound engine
│   │   ├── auth/              # Authentication & Verification
│   │   │   ├── AuthModal.tsx        # 6-digit OTP verification view, login, and registration
│   │   │   ├── GuestLimitModal.tsx  # Guest usage quota prompt
│   │   │   └── UserMenu.tsx         # Profile popover, admin status, and custom instructions
│   │   ├── artifacts/         # Canvas Studio 2.0
│   │   │   ├── ArtifactViewer.tsx   # Multi-tab drawer (Preview, Code, Console, Diff)
│   │   │   ├── ArtifactConsole.tsx  # postMessage console logger
│   │   │   └── ArtifactDiffViewer.tsx # Visual line diff comparison
│   │   ├── tools/             # ReAct Tool Visualizations
│   │   │   └── ToolExecutionCard.tsx # Collapsible tool step card
│   │   ├── agents/            # Multi-Agent Swarms & Operations Studio
│   │   │   ├── AgentSwarmCard.tsx     # In-chat dynamic swarm stepper & thought inspector
│   │   │   └── AgentWorkflowModal.tsx # Agent Operations Studio (DAG visualizer & runs)
│   │   ├── knowledge/         # 2D Knowledge Graph Visualizer Modal
│   │   ├── developer/         # API Keys & Webhooks Management Modal
│   │   ├── evals/             # LLM Evaluation Dashboard Modal
│   │   ├── arena/             # Model Arena Split-Battle Modal
│   │   ├── workspaces/        # Workspace Switcher & Team RBAC Modal
│   │   └── layout/            # AppShell, TopBar, and Sidebar Overlays
│   │
│   ├── lib/
│   │   ├── api/               # Abstracted, strongly-typed API client SDK
│   │   │   ├── client.ts      # Reusable fetch client with auth token refresh
│   │   │   ├── auth.ts        # OTP registration, verification, resend & login
│   │   │   ├── chat.ts        # SSE streaming chat client with effort & tool step parsing
│   │   │   ├── agents.ts      # DAG workflow runner client
│   │   │   ├── developer.ts   # API keys & webhooks API client
│   │   │   ├── evals.ts       # LLM-as-a-judge evals API client
│   │   │   ├── graph.ts       # Knowledge graph API client
│   │   │   └── documents.ts   # Document ingestion and vector chunk client
│   │   ├── context/           # React Context Providers
│   │   │   ├── ChatContext.tsx      # Conversation state, SSE handling, message branching
│   │   │   ├── ArtifactContext.tsx  # Active artifact state and canvas visibility
│   │   │   ├── AuthContext.tsx      # User authentication and token persistence
│   │   │   └── ThemeContext.tsx     # System, dark, and light theme sync
│   │   └── types.ts           # Central TypeScript definitions
│   │
│   ├── globals.css            # Tailwind CSS v4 & .liquid-glass / .liquid-glass-modal styling
│   ├── layout.tsx             # Root layout with theme and auth providers
│   └── page.tsx               # Main application entrypoint
│
├── Dockerfile                 # Multi-stage standalone production build
├── next.config.ts             # Next.js standalone output configuration
├── package.json
└── tsconfig.json
```

---

## 🐳 Docker Deployment & Container Updates

The frontend is containerized using a multi-stage Docker build utilizing Next.js **standalone output** for minimal image size ($< 120$MB) and high performance.

### Running with Docker Compose
From the repository root:
```bash
docker compose up -d frontend
```

### 2. Container Lifecycle & Data Preservation Guide

| Operation | Command | What It Does | Are Conversations & DB Saved? |
| :--- | :--- | :--- | :---: |
| **Pause / Stop** | `docker compose stop frontend` | Halts frontend container without destroying it. | **YES (100% Intact)** |
| **Resume** | `docker compose start frontend` | Resumes frontend container in ~1 second. | **YES (100% Intact)** |
| **Teardown** | `docker compose down` | Stops and removes container instances and network bridge. | **YES (Named volumes preserved)** |
| **Full Wipe** | `docker compose down -v` | Stops containers and **destroys all database & vector volumes**. | ⚠️ **NO (Purges all data)** |

> [!NOTE]
> **Data Volume Safety**: Running `docker compose down` stops and removes compute instances while safely preserving your named PostgreSQL (`postgres_data`) and Qdrant (`qdrant_data`) volumes on host disk. Data is only erased if you explicitly pass the `-v` flag (`docker compose down -v`).

### 🚀 Everyday Fast Update: Recompile in 3–5 Seconds (Recommended)
For all normal UI code, component, and style updates:
```bash
docker compose up -d --build --no-deps frontend
```
> [!TIP]
> **Why this is instant:**
> - Docker layer caching keeps `npm ci` cached (**0.0s**).
> - Next.js Turbopack incrementally compiles only your modified `.tsx` and `.css` files.
> - Backend, PostgreSQL, and Qdrant stay running with **zero downtime** (`--no-deps`).

### ⚡ Clean Rebuild (Only When package.json Changes)
```bash
docker compose build --no-cache frontend && docker compose up -d --no-deps frontend
```

### 🔍 Container Diagnostics
```bash
# Check container status
docker compose ps frontend

# View live frontend logs
docker compose logs -f --tail=100 frontend
```

---

## 💻 Local Development Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Environment Configuration (`.env.local`)
Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 3. Start Development Server with Turbopack
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Verify Production Build & TypeScript Types
```bash
npm run build
```
*(Zero TypeScript and ESLint errors are strictly enforced)*
