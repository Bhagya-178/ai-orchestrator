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
  - `⚡ Low (Fast · 2 iters)`: Quick single-action turn or pruned 3-agent swarm (600-token budget per agent) returning fullstack deliverables in ~20s.
  - `⚖️ Medium (5 iters)`: Standard 3–5 step plan-action-observe loop or full 5-agent DAG (1200-token budget per agent) completing in ~60s.
  - `🧠 High (10 iters + Reflection)`: Deep multi-tool execution chains (2500-token budget) with autonomous security reflection/patch loops.
  - Passes dynamic effort state through `ChatContext` to `/chat/stream` with live reasoning budget telemetry.
- **Immediate Live Swarm Token Streaming**:
  - Emits the workflow header immediately at $t = 0$.
  - As each agent finishes, its output instantly streams into the chat message as markdown tokens, delivering continuous real-time progress every 6–12 seconds without UI freeze.
- **Inline Multi-Agent Swarm Stepper (`AgentSwarmCard.tsx`)**: Big-Tech style in-chat collaboration stepper showing the 5-agent team (Architect $\rightarrow$ Researcher $\rightarrow$ Lead Coder $\rightarrow$ Security Auditor $\rightarrow$ Synthesis Critic) with real-time status badges, duration in ms, and expandable reasoning accordions to inspect intermediate agent outputs.
- **Quick `⚡ Swarm` Toggle**: 1-click button in the composer toolbar to execute full-stack multi-agent swarms without manual DAG configuration.
- **Inline ReAct & Agent Swarm Cards (`ToolExecutionCard.tsx`)**: Invocations of external tools and swarm agent roles stream directly into the conversation turn with dedicated `Bot` icons, role badges (`Agent: <role>`), execution timings, collapsible parameter/result inspectors, and error handling.
- **Prompt History Navigation**: Up and Down arrow key history traversal (persisted to localStorage and pre-seeded from database) allowing seamless prompt recall just like modern AI interfaces.
- **Interactive Message Controls**: In-place prompt editing with branching, message regeneration, clipboard copy with fallback, and Web Speech / audio playback.
- **Document Context Pill**: Non-intrusive attachment pill for PDF, DOCX, and TXT files with one-click context toggling and status indicators.

### 2. 6-Digit Email OTP Verification & Access Control (`AuthModal.tsx`)
- **Seamless Verification Flow**: On registration, the modal transitions to an enterprise 6-digit code verification view.
- **Interactive Input Mechanics**: Auto-focus advancing across 6 individual digit fields, backspace navigation, and smart clipboard paste parsing.
- **Resend Cooldown Timer**: 60-second animated countdown protecting against spam and rate-limit exhaustion.
- **Dev-Mode Quick-Fill Pill**: When running without production SMTP, displays an automatic 1-click badge with the local `dev_otp` for rapid local testing.
- **Admin Support**: Direct authentication support for administrative accounts provisioned securely via environment variables (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

### 3. Canvas Studio 2.0 (`app/components/artifacts/`)
Full Claude Artifacts parity for code, interactive web applications, SVGs, and Mermaid diagrams:
- **Multi-Tab Workspace**:
  - `Preview`: Sandboxed iframe with live execution of HTML/CSS/JavaScript and React widgets.
  - `Code Editor`: Syntax-highlighted code editor with copy and edit controls.
  - `Console`: Real-time `postMessage` logging bridge capturing iframe `console.log`, `console.warn`, and `console.error` calls.
  - `Diff`: Visual line-by-line diff comparing original vs edited artifact revisions.
- **Interactive Controls**: Built-in pan, zoom, reset, fullscreen, and download capabilities for SVGs and diagrams.

### 4. Agent Operations Studio (`app/components/agents/`)
A dedicated mission-control hub for autonomous Directed Acyclic Graph pipelines:
- **Previous Runs Archive**: Persistent execution history stored in PostgreSQL (`WorkflowRun`) and mirrored to local storage—review past objectives, node outputs, and timings across sessions.
- **Interactive DAG Topology & Node Inspector**: Step through the visual flow of Kahn-sorted agent nodes, clicking any node to inspect that agent's exact prompt, reasoning, and duration.
- **💬 Continue in Chat**: 1-click export of any past or current workflow deliverable into the active chat conversation.

### 5. Categorized "Studio & Tools ▾" Popover (`TopBar.tsx`)
Consolidates 10 disparate studio features into an uncluttered popover menu organized into 4 intuitive categories:
- **Agents & Knowledge**:
  - *Agent Operations Studio*: Visual Directed Acyclic Graph editor, runs archive, role config, and live execution telemetry.
  - *Knowledge Graph Visualizer*: 2D interactive SVG network visualizer with PageRank metrics and entity search.
- **Model Lab & Evals**:
  - *Model Arena*: Side-by-side split battles comparing latency, TTFT, and output quality between models.
  - *Evals Dashboard*: LLM-as-a-judge benchmark scorecards measuring faithfulness, relevance, and hallucination rates with auto-populated candidate and judge model selection dropdowns.
- **Platform & System**:
  - *Developer Studio*: Self-service scoped API key creation and HMAC-SHA256 webhook subscriptions.
  - *Settings & Documents*: System theme, vector chunk inspector, and document manager.
- **Workspaces**:
  - *Workspace Switcher*: Multi-tenant team workspace management with role-based access control (`owner`, `admin`, `member`, `viewer`).

---

## 📂 Project Architecture

```text
frontend/
├── app/
│   ├── components/
│   │   ├── chat/              # Core Chat Experience
│   │   │   ├── ChatComposer.tsx     # Dynamic effort selector, file upload, voice, history navigation
│   │   │   ├── ChatView.tsx         # Message feed, scroll anchors, empty states
│   │   │   └── MessageBubble.tsx    # Markdown, syntax highlighter, inline ReAct cards
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
│   │   ├── layout/            # AppShell, TopBar, and Sidebar Overlays
│   │   └── voice/             # Web Audio MediaRecorder & SpeechPlayer
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
│   ├── globals.css            # Tailwind CSS v4 configuration and variables
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

### 🔄 How to Update the Frontend Container
Whenever changes are made to frontend code, components, or npm packages:

1. **Rebuild without cache**:
   ```bash
   docker compose build --no-cache frontend
   docker compose up -d --no-deps frontend
   ```

2. **One-Liner Rebuild & Restart**:
   ```bash
   docker compose up -d --build --force-recreate frontend
   ```

3. **Check Frontend Logs**:
   ```bash
   docker compose logs -f --tail=100 frontend
   ```

4. **Verify Container Health**:
   Visit [http://localhost:3000](http://localhost:3000) in your browser.

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
