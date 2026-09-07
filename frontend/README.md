# 🎨 AI Orchestrator Frontend UI

A production-grade, minimalist AI operating frontend built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **Turbopack**.

Designed with **Claude and ChatGPT parity**, the frontend provides a distraction-free conversation canvas while seamlessly housing enterprise power tools: interactive multi-tab artifacts (Canvas Studio 2.0), real-time ReAct tool execution telemetry, 2D entity knowledge graph exploration, multi-agent DAG workflow orchestration, and a developer platform for API keys and webhooks.

---

## ⚡ Core UI Capabilities

### 1. Minimalist Claude/ChatGPT Chat Feed & ReAct Telemetry
- **Distraction-Free Chat**: Clean, uncluttered layout with responsive typography, smooth auto-scrolling with floating "scroll-to-bottom" pill, and empty-state starter prompts.
- **Inline ReAct Execution Cards (`ToolExecutionCard.tsx`)**: Invocations of external tools (safe AST math, SQL database queries, sandboxed file system, web search, code runner) stream directly into the conversation turn with real-time status badges, execution timings, collapsible parameter/result inspectors, and error handling.
- **Prompt History Navigation**: Up and Down arrow key history traversal (persisted to localStorage and pre-seeded from database) allowing seamless prompt recall just like modern AI interfaces.
- **Interactive Message Controls**: In-place prompt editing with branching, message regeneration, clipboard copy with fallback, and Web Speech / audio playback.
- **Document Context Pill**: Non-intrusive attachment pill for PDF, DOCX, and TXT files with one-click context toggling and status indicators.

### 2. Canvas Studio 2.0 (`app/components/artifacts/`)
Full Claude Artifacts parity for code, interactive web applications, SVGs, and Mermaid diagrams:
- **Multi-Tab Workspace**:
  - `Preview`: Sandboxed iframe with live execution of HTML/CSS/JavaScript and React widgets.
  - `Code Editor`: Syntax-highlighted code editor with copy and edit controls.
  - `Console`: Real-time `postMessage` logging bridge capturing iframe `console.log`, `console.warn`, and `console.error` calls.
  - `Diff`: Visual line-by-line diff comparing original vs edited artifact revisions.
- **Interactive Controls**: Built-in pan, zoom, reset, fullscreen, and download capabilities for SVGs and diagrams.

### 3. Categorized "Studio & Tools ▾" Popover (`TopBar.tsx`)
Consolidates 10 disparate studio features into an uncluttered popover menu organized into 4 intuitive categories:
- **Agents & Knowledge**:
  - *Multi-Agent DAG Studio*: Visual Directed Acyclic Graph editor, role config, and live execution telemetry.
  - *Knowledge Graph Visualizer*: 2D interactive SVG network visualizer with PageRank metrics and entity search.
- **Model Lab & Evals**:
  - *Model Arena*: Side-by-side split battles comparing latency, TTFT, and output quality between models.
  - *Evals Dashboard*: LLM-as-a-judge benchmark scorecards measuring faithfulness, relevance, and hallucination rates.
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
│   │   │   ├── ChatComposer.tsx     # Textarea, file upload, voice, history navigation
│   │   │   ├── ChatView.tsx         # Message feed, scroll anchors, empty states
│   │   │   └── MessageBubble.tsx    # Markdown, syntax highlighter, inline ReAct cards
│   │   ├── artifacts/         # Canvas Studio 2.0
│   │   │   ├── ArtifactViewer.tsx   # Multi-tab drawer (Preview, Code, Console, Diff)
│   │   │   ├── ArtifactConsole.tsx  # postMessage console logger
│   │   │   └── ArtifactDiffViewer.tsx # Visual line diff comparison
│   │   ├── tools/             # ReAct Tool Visualizations
│   │   │   └── ToolExecutionCard.tsx # Collapsible tool step card
│   │   ├── agents/            # Multi-Agent DAG Studio Modal
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
│   │   │   ├── chat.ts        # SSE streaming chat client with tool step parsing
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
