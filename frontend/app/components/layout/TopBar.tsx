"use client";

import { useState, useEffect, useRef } from "react";
import {
  Menu,
  Settings,
  Sparkles,
  Swords,
  Cpu,
  BarChart3,
  Users,
  Database,
  Bot,
  Share2,
  Key,
  Award,
  ChevronDown,
  LayoutGrid,
  Plus,
  Lock,
  Check,
} from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import { useChat } from "@/app/lib/context/ChatContext";
import BackendStatus from "../system/BackendStatus";
import SettingsModal from "../system/SettingsModal";
import UserMenu from "../auth/UserMenu";
import PromptLibraryModal from "../prompts/PromptLibraryModal";
import ArenaModal from "../arena/ArenaModal";
import McpServerModal from "../mcp/McpServerModal";
import AnalyticsModal from "../analytics/AnalyticsModal";
import WorkspaceModal from "../workspaces/WorkspaceModal";
import KnowledgeBaseModal from "../knowledge/KnowledgeBaseModal";
import AgentWorkflowModal from "../agents/AgentWorkflowModal";
import GraphVisualizerModal from "../knowledge/GraphVisualizerModal";
import DeveloperStudioModal from "../developer/DeveloperStudioModal";
import EvalsDashboardModal from "../evals/EvalsDashboardModal";
import { getAvailableModels } from "@/app/lib/api/health";

export default function TopBar() {
  const { openSidebar } = useNavigation();
  const { sendMessage, currentTitle, clearChat, intentOverride, setIntentOverride, updateSettings } = useChat();
  const { isAuthenticated } = useAuth();

  const [isStudioMenuOpen, setIsStudioMenuOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const studioMenuRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isArenaOpen, setIsArenaOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);
  const [workflowInitialPrompt, setWorkflowInitialPrompt] = useState("");
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);
  const [isEvalsOpen, setIsEvalsOpen] = useState(false);

  const [models, setModels] = useState<string[]>(["qwen2.5:1.5b", "qwen3:8b"]);

  useEffect(() => {
    const handleOpenWorkflow = (e: any) => {
      setIsAgentsOpen(true);
      if (e.detail?.prompt) {
        setWorkflowInitialPrompt(e.detail.prompt);
      }
    };
    window.addEventListener("open-agent-workflow", handleOpenWorkflow);
    return () => window.removeEventListener("open-agent-workflow", handleOpenWorkflow);
  }, []);

  useEffect(() => {
    getAvailableModels().then(setModels).catch(console.error);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (studioMenuRef.current && !studioMenuRef.current.contains(e.target as Node)) {
        setIsStudioMenuOpen(false);
      }
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setIsModelPickerOpen(false);
      }
    };
    if (isStudioMenuOpen || isModelPickerOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isStudioMenuOpen, isModelPickerOpen]);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-20 gap-3">
        {/* Left: Brand & Sidebar Toggle & New Chat */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={openSidebar}
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
            aria-label="Open navigation"
            title="Open chats sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-gray-900 dark:text-white">
              AI Orchestrator
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 font-mono hidden md:inline">
              v2.0
            </span>
          </div>
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg border border-[var(--border)] transition-colors ml-1"
            title="Start new chat"
          >
            <Plus className="w-3.5 h-3.5 text-gray-500" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>

        {/* Center: Current Chat Title & Model Picker */}
        <div className="flex-1 max-w-sm lg:max-w-md mx-2 flex items-center justify-center gap-2 truncate">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate hidden md:block px-3 py-1 bg-black/5 dark:bg-white/5 rounded-lg border border-[var(--border)]/60">
            {currentTitle || "New Chat"}
          </span>

          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelPickerRef}>
            <button
              onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg border border-[var(--border)] transition-colors cursor-pointer"
              title="Active Model (Click to switch)"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="max-w-[120px] truncate font-mono text-[11px]">
                {intentOverride === "auto" ? "Auto Model" : intentOverride}
              </span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isModelPickerOpen ? "rotate-180" : ""}`} />
            </button>

            {isModelPickerOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 border-b border-[var(--border)] mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    Available Models ({models.length})
                  </span>
                </div>

                <div className="space-y-0.5 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setIntentOverride("auto");
                      updateSettings("auto", undefined);
                      setIsModelPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                      intentOverride === "auto"
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                        : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      <span>Auto Model (Smart Router)</span>
                    </div>
                    {intentOverride === "auto" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>

                  {models
                    .filter((m) => !m.includes("embed") && !m.includes("bge-m3"))
                    .map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setIntentOverride(m);
                          updateSettings(m, undefined);
                          setIsModelPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors cursor-pointer ${
                          intentOverride === m
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                            : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <span className="truncate">{m}</span>
                        {intentOverride === m && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Clean Action Center */}
        <div className="flex items-center gap-2">
          {/* Quick Launcher: Studio & Tools Menu */}
          <div className="relative" ref={studioMenuRef}>
            <button
              onClick={() => setIsStudioMenuOpen(!isStudioMenuOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                isStudioMenuOpen
                  ? "bg-black/5 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white shadow-xs"
                  : "border-[var(--border)] text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-purple-500" />
              <span>Studio & Tools</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isStudioMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Categorized Dropdown Popover */}
            {isStudioMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl p-3 grid grid-cols-1 gap-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Section 1: Autonomous Agents & RAG */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">
                    Agents & Knowledge
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => {
                        setIsAgentsOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">Agents DAG</div>
                        <div className="text-[10px] text-gray-400 truncate">Autonomous workflows</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsGraphOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center shrink-0">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">Knowledge Graph</div>
                        <div className="text-[10px] text-gray-400 truncate">2D Entity network</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsKnowledgeOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">Hybrid RAG</div>
                        <div className="text-[10px] text-gray-400 truncate">Vector + BM25</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsMcpOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">MCP Hub</div>
                        <div className="text-[10px] text-gray-400 truncate">External tools</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[var(--border)]" />

                {/* Section 2: Model Lab & Evals */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">
                    Model Lab & Evals
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => {
                        setIsArenaOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 flex items-center justify-center shrink-0">
                        <Swords className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">Model Arena</div>
                        <div className="text-[10px] text-gray-400 truncate">Split-stream battle</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsEvalsOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors group relative"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-900 dark:text-white truncate">LLM Evals</span>
                          {!isAuthenticated && <Lock className="w-3 h-3 text-gray-400" />}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">Judge scorecards</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsPromptsOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">Prompt Studio</div>
                        <div className="text-[10px] text-gray-400 truncate">Template library</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setIsDeveloperOpen(true);
                        setIsStudioMenuOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group relative"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center shrink-0">
                        <Key className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-900 dark:text-white truncate">Developer API</span>
                          {!isAuthenticated && <Lock className="w-3 h-3 text-gray-400" />}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">Keys & Webhooks</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[var(--border)]" />

                {/* Section 3: Platform Metrics & Workspaces */}
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => {
                      setIsAnalyticsOpen(true);
                      setIsStudioMenuOpen(false);
                    }}
                    className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-emerald-500 py-1"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Analytics</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsWorkspacesOpen(true);
                      setIsStudioMenuOpen(false);
                    }}
                    className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-indigo-500 py-1"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Workspaces</span>
                    {!isAuthenticated && <Lock className="w-2.5 h-2.5 text-gray-400 ml-0.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-[var(--border)] mx-0.5" />

          {/* Backend Status Badge */}
          <BackendStatus />

          {/* Settings Modal Launcher */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* User Menu */}
          <UserMenu />
        </div>
      </header>

      {/* Modals Mounting */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <PromptLibraryModal
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        onInsertPrompt={(text) => sendMessage(text)}
      />

      <ArenaModal
        isOpen={isArenaOpen}
        onClose={() => setIsArenaOpen(false)}
        availableModels={models}
      />

      <McpServerModal
        isOpen={isMcpOpen}
        onClose={() => setIsMcpOpen(false)}
      />

      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />

      <WorkspaceModal
        isOpen={isWorkspacesOpen}
        onClose={() => setIsWorkspacesOpen(false)}
      />

      <KnowledgeBaseModal
        isOpen={isKnowledgeOpen}
        onClose={() => setIsKnowledgeOpen(false)}
      />

      <AgentWorkflowModal
        isOpen={isAgentsOpen}
        initialPrompt={workflowInitialPrompt}
        onClose={() => {
          setIsAgentsOpen(false);
          setWorkflowInitialPrompt("");
        }}
      />

      <GraphVisualizerModal
        isOpen={isGraphOpen}
        onClose={() => setIsGraphOpen(false)}
      />

      <DeveloperStudioModal
        isOpen={isDeveloperOpen}
        onClose={() => setIsDeveloperOpen(false)}
      />

      <EvalsDashboardModal
        isOpen={isEvalsOpen}
        onClose={() => setIsEvalsOpen(false)}
        availableModels={models}
      />
    </>
  );
}
