# AI Orchestrator Frontend

The frontend interface for the AI Orchestrator. It provides a polished, Claude-like unified interface to interact with multiple local AI models (via Ollama) and your local RAG document knowledge base.

## Key Features

- **Seamless RAG Integration:** Upload PDFs, TXTs, or Word Documents directly into the chat. The system automatically searches them and uses them for context if your questions relate to them, working just like Claude without requiring you to manually request a document search.
- **Floating Conversation Overlay:** A minimalistic, unobtrusive sidebar that only appears when you hover or click the menu button, ensuring the main chat window remains the center of focus.
- **Dark & Light Mode:** First-class support for system, dark, and light themes with beautiful Tailwind CSS variables.
- **Real-time Status Monitoring:** Monitors whether the local Ollama backend is online/offline and displays connection status.
- **File & Conversation Management:** Securely view and delete uploaded documents (and their Qdrant vector chunks) from the settings modal, and delete old conversations directly from the sidebar.
- **Smart Model Routing:** A unified interface that automatically routes to four specialized models (General, Coding, Study, Reasoning) under the hood based on your intent.

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [React Markdown](https://github.com/remarkjs/react-markdown) (with Syntax Highlighting)

## Architecture Overview

Instead of a monolithic design, the application is broken down into structured components and state contexts:

- `app/components/chat/` - Holds the `ChatView`, `ChatComposer`, and `MessageBubble` components.
- `app/components/conversations/` - Sidebar list for fetching and deleting historical chats.
- `app/components/documents/` - Upload attachment pill that dynamically tracks file size and ingestion status.
- `app/components/system/` - Global UI components like the `SettingsModal` and `BackendStatus` checker.
- `app/lib/api/` - Abstracted Fetch API routes to interact with the Python backend (`chat.ts`, `conversations.ts`, `documents.ts`, `health.ts`).
- `app/lib/context/` - React Context providers (`ChatContext`, `NavigationContext`, `ThemeContext`) to eliminate prop-drilling.

## Getting Started

First, ensure the Python backend is running on `http://127.0.0.1:8000`.

Then, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
