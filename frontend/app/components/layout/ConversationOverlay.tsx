"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, X, Bot, Share2, Database, Cpu, Swords, Award, Sparkles,
  Key, BarChart3, Users, Settings, ChevronDown, ChevronRight,
  MessageSquare, User as UserIcon,
} from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import { useChat } from "@/app/lib/context/ChatContext";
import { useAuth } from "@/app/lib/context/AuthContext";
import ConversationList from "../conversations/ConversationList";
import AgentWorkflowModal from "../agents/AgentWorkflowModal";
import GraphVisualizerModal from "../knowledge/GraphVisualizerModal";
import KnowledgeBaseModal from "../knowledge/KnowledgeBaseModal";
import McpServerModal from "../mcp/McpServerModal";
import ArenaModal from "../arena/ArenaModal";
import EvalsDashboardModal from "../evals/EvalsDashboardModal";
import PromptLibraryModal from "../prompts/PromptLibraryModal";
import DeveloperStudioModal from "../developer/DeveloperStudioModal";
import AnalyticsModal from "../analytics/AnalyticsModal";
import WorkspaceModal from "../workspaces/WorkspaceModal";
import SettingsModal from "../system/SettingsModal";
import { getAvailableModels } from "@/app/lib/api/health";

export default function ConversationOverlay() {
  const { isSidebarOpen, closeSidebar } = useNavigation();
  const { clearChat, sendMessage } = useChat();
  const {
    user,
    isAuthenticated,
    guestMessageCount,
    guestMessageLimit,
    setShowAuthModal,
    setAuthModalMode,
  } = useAuth();

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Desktop hover: controls icon-rail ↔ expanded sidebar
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [models, setModels] = useState<string[]>(["qwen2.5:1.5b", "qwen3:8b"]);

  // Modal states (moved here from TopBar)
  const [isAgentsOpen, setIsAgentsOpen] = useState(false);
  const [workflowInitialPrompt, setWorkflowInitialPrompt] = useState("");
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [isMcpOpen, setIsMcpOpen] = useState(false);
  const [isArenaOpen, setIsArenaOpen] = useState(false);
  const [isEvalsOpen, setIsEvalsOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isWorkspacesOpen, setIsWorkspacesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    getAvailableModels().then(setModels).catch(console.error);
  }, []);

  // Listen for open-agent-workflow event (from ChatComposer's Studio button)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      setIsAgentsOpen(true);
      if (ce.detail?.prompt) setWorkflowInitialPrompt(ce.detail.prompt);
    };
    window.addEventListener("open-agent-workflow", handler);
    return () => window.removeEventListener("open-agent-workflow", handler);
  }, []);

  // Close on outside click (mobile)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        closeSidebar();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isSidebarOpen, closeSidebar]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSidebar]);

  const collapse = () => {
    setIsExpanded(false);
    setIsStudioOpen(false);
  };

  const openTool = (fn: () => void) => {
    fn();
    closeSidebar();
    collapse();
  };

  const studioTools = [
    { icon: Bot,       label: "Agents DAG",     color: "text-purple-500", onClick: () => setIsAgentsOpen(true) },
    { icon: Share2,    label: "Knowledge Graph", color: "text-blue-500",   onClick: () => setIsGraphOpen(true) },
    { icon: Database,  label: "Hybrid RAG",      color: "text-cyan-500",   onClick: () => setIsKnowledgeOpen(true) },
    { icon: Cpu,       label: "MCP Hub",         color: "text-emerald-500",onClick: () => setIsMcpOpen(true) },
    { icon: Swords,    label: "Model Arena",     color: "text-orange-500", onClick: () => setIsArenaOpen(true) },
    { icon: Award,     label: "LLM Evals",       color: "text-indigo-500", onClick: () => setIsEvalsOpen(true) },
    { icon: Sparkles,  label: "Prompt Studio",   color: "text-violet-500", onClick: () => setIsPromptsOpen(true) },
    { icon: Key,       label: "Developer API",   color: "text-emerald-500",onClick: () => setIsDeveloperOpen(true) },
    { icon: BarChart3, label: "Analytics",       color: "text-teal-500",   onClick: () => setIsAnalyticsOpen(true) },
    { icon: Users,     label: "Workspaces",      color: "text-indigo-500", onClick: () => setIsWorkspacesOpen(true) },
  ];

  const userInitial = user?.full_name
    ? user.full_name[0].toUpperCase()
    : user?.email
    ? user.email[0].toUpperCase()
    : "?";

  // ── Responsive helpers ──
  // Effective expanded state: true if hovered OR toggled/pinned open
  const effectiveExpanded = isExpanded || isSidebarOpen;

  // Label: hidden on desktop when collapsed; always visible on mobile or when expanded.
  const labelCls = [
    "overflow-hidden whitespace-nowrap transition-all duration-200 leading-none",
    effectiveExpanded
      ? "max-w-[9rem] opacity-100"            // desktop expanded + mobile
      : "md:max-w-0 md:opacity-0 max-w-[9rem] opacity-100", // desktop hidden; mobile visible
  ].join(" ");

  // Row layout: icon-centered on desktop when collapsed; icon+label otherwise.
  const rowCls = [
    "flex items-center py-2 rounded-lg w-full transition-colors cursor-pointer",
    "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5",
    effectiveExpanded
      ? "px-3 gap-2.5 justify-start"                                   // always icon+label
      : "px-3 gap-2.5 justify-start md:px-0 md:gap-0 md:justify-center", // mobile: icon+label, desktop: icon-only
  ].join(" ");

  return (
    <>
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar panel ── */}
      <div
        ref={sidebarRef}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={collapse}
        className={[
          "flex flex-col bg-[var(--sidebar)] border-r border-[var(--border)] select-none",
          // Mobile: fixed overlay drawer, always w-64
          "fixed inset-y-0 left-0 z-50 w-64",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: relative, collapsible icon-rail → full sidebar on hover or toggle
          "md:relative md:translate-x-0 md:z-auto md:h-full md:overflow-hidden",
          effectiveExpanded ? "md:w-64" : "md:w-14",
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div
          className={[
            "flex items-center h-11 border-b border-[var(--border)] shrink-0 overflow-hidden transition-all",
            effectiveExpanded ? "px-3 gap-2.5" : "px-3 gap-2.5 md:px-0 md:justify-center",
          ].join(" ")}
        >
          {/* Logo icon */}
          <div className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[11px] tracking-tight">AI</span>
          </div>

          {/* Brand name — hidden on desktop when collapsed */}
          <span className={`${labelCls} text-sm font-semibold tracking-tight text-[var(--foreground)]`}>
            AI Orchestrator
          </span>

          {/* Mobile close button — never shown on desktop */}
          <button
            onClick={closeSidebar}
            className="ml-auto p-1 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors md:hidden shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── New chat ── */}
        <div className="px-2 pt-2 pb-1 shrink-0">
          <button
            onClick={() => { clearChat(); closeSidebar(); collapse(); }}
            className={rowCls}
            title={!effectiveExpanded ? "New chat" : undefined}
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className={`${labelCls} text-sm font-medium`}>New chat</span>
          </button>
        </div>

        {/* ── Conversation list ──
            Desktop: invisible when collapsed (icons rail is too narrow for a list).
            Mobile: always visible.
        */}
        <div
          className={[
            "flex-1 overflow-y-auto px-2 py-1 min-h-0 transition-opacity duration-200",
            effectiveExpanded ? "opacity-100" : "opacity-100 md:opacity-0 md:pointer-events-none",
          ].join(" ")}
        >
          <div className="px-3 pt-1 pb-1">
            <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">
              Conversations
            </span>
          </div>
          <ConversationList onSelect={() => { closeSidebar(); collapse(); }} />
        </div>

        {/* ── Studio & Tools ── */}
        <div className="border-t border-[var(--border)] px-2 py-2 shrink-0">
          {/* Collapsed desktop: single icon hint */}
          <button
            onClick={() => setIsExpanded(true)}
            className={[
              "w-full items-center justify-center py-2 rounded-lg transition-colors",
              "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5",
              effectiveExpanded ? "hidden" : "hidden md:flex", // desktop only, when collapsed
            ].join(" ")}
            title="Studio & Tools (hover to expand)"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Expanded (always on mobile, on-hover on desktop) */}
          <div className={effectiveExpanded ? "block" : "block md:hidden"}>
            <button
              onClick={() => setIsStudioOpen(!isStudioOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="uppercase tracking-wider text-[10px]">Studio & Tools</span>
              </div>
              {isStudioOpen
                ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              }
            </button>
            {isStudioOpen && (
              <div className="grid grid-cols-2 gap-0.5 mt-1">
                {studioTools.map((tool) => (
                  <button
                    key={tool.label}
                    onClick={() => openTool(tool.onClick)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
                  >
                    <tool.icon className={`w-3.5 h-3.5 shrink-0 ${tool.color}`} />
                    <span className="truncate">{tool.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer: Settings + User ── */}
        <div className="border-t border-[var(--border)] px-2 py-2 space-y-0.5 shrink-0">
          {/* Settings */}
          <button
            onClick={() => { setIsSettingsOpen(true); closeSidebar(); collapse(); }}
            className={rowCls}
            title={!effectiveExpanded ? "Settings" : undefined}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className={`${labelCls} text-sm`}>Settings</span>
          </button>

          {/* User / Guest */}
          {!isAuthenticated ? (
            <>
              {/* Collapsed desktop: small login icon */}
              <button
                onClick={() => { setAuthModalMode("login"); setShowAuthModal(true); }}
                className={[
                  "w-full items-center justify-center py-2 rounded-lg transition-colors",
                  "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5",
                  effectiveExpanded ? "hidden" : "hidden md:flex",
                ].join(" ")}
                title="Sign in"
              >
                <UserIcon className="w-4 h-4" />
              </button>

              {/* Expanded / mobile: progress bar + sign in */}
              <div className={effectiveExpanded ? "block" : "block md:hidden"}>
                <div className="px-3 pb-1 pt-1">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[var(--muted)]">
                      Guest · {guestMessageCount}/{guestMessageLimit}
                    </span>
                    <button
                      onClick={() => { setAuthModalMode("login"); setShowAuthModal(true); closeSidebar(); }}
                      className="text-blue-500 hover:text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      Sign in →
                    </button>
                  </div>
                  <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (guestMessageCount / guestMessageLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Authenticated */
            <div
              className={[
                "flex items-center py-1.5 transition-all duration-200",
                effectiveExpanded
                  ? "px-3 gap-2.5"
                  : "px-3 gap-2.5 md:px-0 md:justify-center md:gap-0",
              ].join(" ")}
              title={!effectiveExpanded ? (user?.full_name || user?.email) : undefined}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
                {userInitial}
              </div>
              <div
                className={[
                  "flex-1 min-w-0 transition-all duration-200",
                  effectiveExpanded
                    ? "opacity-100 max-w-[9rem]"
                    : "opacity-100 max-w-[9rem] md:opacity-0 md:max-w-0 md:overflow-hidden",
                ].join(" ")}
              >
                <div className="text-xs font-medium text-[var(--foreground)] truncate">
                  {user?.full_name || user?.email}
                </div>
                <div className="text-[11px] text-[var(--muted)] truncate">{user?.email}</div>
              </div>
              {user?.role === "admin" && effectiveExpanded && (
                <span className="text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded shrink-0 border border-purple-500/15">
                  Admin
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── All Modals ── */}
      <AgentWorkflowModal
        isOpen={isAgentsOpen}
        initialPrompt={workflowInitialPrompt}
        onClose={() => { setIsAgentsOpen(false); setWorkflowInitialPrompt(""); }}
      />
      <GraphVisualizerModal isOpen={isGraphOpen} onClose={() => setIsGraphOpen(false)} />
      <KnowledgeBaseModal isOpen={isKnowledgeOpen} onClose={() => setIsKnowledgeOpen(false)} />
      <McpServerModal isOpen={isMcpOpen} onClose={() => setIsMcpOpen(false)} />
      <ArenaModal isOpen={isArenaOpen} onClose={() => setIsArenaOpen(false)} availableModels={models} />
      <EvalsDashboardModal isOpen={isEvalsOpen} onClose={() => setIsEvalsOpen(false)} availableModels={models} />
      <PromptLibraryModal
        isOpen={isPromptsOpen}
        onClose={() => setIsPromptsOpen(false)}
        onInsertPrompt={(text) => sendMessage(text)}
      />
      <DeveloperStudioModal isOpen={isDeveloperOpen} onClose={() => setIsDeveloperOpen(false)} />
      <AnalyticsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
      <WorkspaceModal isOpen={isWorkspacesOpen} onClose={() => setIsWorkspacesOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
