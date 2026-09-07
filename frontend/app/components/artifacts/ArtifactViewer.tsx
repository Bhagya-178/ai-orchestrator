"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Eye,
  Code as CodeIcon,
  Sparkles,
  Terminal,
  ArrowLeftRight,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useArtifact } from "@/app/lib/context/ArtifactContext";
import { useTheme } from "@/app/lib/context/ThemeContext";
import { buildSandboxHtml } from "@/app/lib/utils/artifactParser";
import { CanvasTab, ConsoleMessage } from "@/app/lib/types";
import ArtifactConsole from "./ArtifactConsole";
import ArtifactDiffViewer from "./ArtifactDiffViewer";

export default function ArtifactViewer() {
  const { activeArtifact, isCanvasOpen, closeCanvas } = useArtifact();
  const { resolvedTheme } = useTheme();

  const [currentTab, setCurrentTab] = useState<CanvasTab>("preview");
  const [copied, setCopied] = useState(false);
  const [editableCode, setEditableCode] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [logs, setLogs] = useState<ConsoleMessage[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Sync initial artifact content
  useEffect(() => {
    if (activeArtifact) {
      setEditableCode(activeArtifact.content);
      setActiveCode(activeArtifact.content);
      setLogs([]);
      setZoomLevel(1.0);
    }
  }, [activeArtifact?.id, activeArtifact?.content]);

  // Listen to postMessage from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "SANDBOX_CONSOLE") {
        const newLog: ConsoleMessage = {
          id: Math.random().toString(36).substring(2, 9),
          type: event.data.level || "log",
          message: event.data.message || "",
          timestamp: new Date().toLocaleTimeString(),
        };
        setLogs((prev) => [...prev.slice(-100), newLog]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeCode]);

  const handleDownload = useCallback(() => {
    if (!activeArtifact) return;
    const extensions: Record<string, string> = {
      html: "html",
      svg: "svg",
      react: "jsx",
      python: "py",
      py: "py",
      javascript: "js",
      js: "js",
      mermaid: "mmd",
    };
    const ext = extensions[activeArtifact.language] || "txt";
    const blob = new Blob([activeCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeArtifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeArtifact, activeCode]);

  const handleRunCode = () => {
    setActiveCode(editableCode);
    setIsEditing(false);
    setCurrentTab("preview");
  };

  const handleResetCode = () => {
    if (activeArtifact) {
      setEditableCode(activeArtifact.content);
      setActiveCode(activeArtifact.content);
      setIsEditing(false);
    }
  };

  if (!isCanvasOpen || !activeArtifact) return null;

  const canPreview =
    activeArtifact.type === "html" ||
    activeArtifact.type === "svg" ||
    activeArtifact.type === "mermaid";

  const currentArtifactForSandbox = {
    ...activeArtifact,
    content: activeCode,
  };
  const sandboxSrcDoc = buildSandboxHtml(currentArtifactForSandbox);

  const errorCount = logs.filter((l) => l.type === "error").length;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[580px] md:w-[680px] lg:w-[780px] xl:w-[840px] bg-[var(--background)] border-l border-[var(--border)] shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
      {/* Studio Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {activeArtifact.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                {activeArtifact.language}
              </span>
              {editableCode !== activeArtifact.content && (
                <span className="text-[10px] font-medium text-amber-500">
                  (Modified)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Navigation Tabs */}
          <div className="flex items-center p-0.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg mr-1">
            <button
              onClick={() => setCurrentTab("preview")}
              disabled={!canPreview}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentTab === "preview"
                  ? "bg-white dark:bg-[#27272a] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 cursor-pointer"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setCurrentTab("code")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentTab === "code"
                  ? "bg-white dark:bg-[#27272a] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              }`}
            >
              <CodeIcon className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
            <button
              onClick={() => setCurrentTab("console")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all relative ${
                currentTab === "console"
                  ? "bg-white dark:bg-[#27272a] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console</span>
              {errorCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5" />
              )}
            </button>
            <button
              onClick={() => setCurrentTab("diff")}
              disabled={editableCode === activeArtifact.content}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentTab === "diff"
                  ? "bg-white dark:bg-[#27272a] text-gray-900 dark:text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-30 cursor-pointer"
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Diff</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Download Artifact"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={closeCanvas}
            className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors ml-1"
            title="Close Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="flex-1 overflow-hidden relative bg-[var(--background)] flex flex-col">
        {currentTab === "preview" && canPreview && (
          <div className="flex-1 flex flex-col h-full relative">
            {/* Zoom / Pan Bar */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shadow-lg text-white text-xs">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.15))}
                className="p-1 hover:text-blue-400 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.15))}
                className="p-1 hover:text-blue-400 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                className="p-1 hover:text-blue-400 transition-colors ml-0.5"
                title="Reset Zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-auto flex items-center justify-center">
              <div
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                className="w-full h-full transition-transform duration-150"
              >
                <iframe
                  srcDoc={sandboxSrcDoc}
                  title={activeArtifact.title}
                  sandbox="allow-scripts allow-modals"
                  className="w-full h-full rounded-xl border border-[var(--border)] bg-white shadow-xs"
                />
              </div>
            </div>
          </div>
        )}

        {currentTab === "code" && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Code Controls */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    isEditing
                      ? "bg-blue-600 text-white"
                      : "bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {isEditing ? "Editing Mode" : "Read-Only Mode"}
                </button>
              </div>

              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetCode}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-md transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={handleRunCode}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shadow-xs"
                  >
                    <Play className="w-3 h-3" />
                    <span>Apply & Run</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto text-xs sm:text-sm">
              {isEditing ? (
                <textarea
                  value={editableCode}
                  onChange={(e) => setEditableCode(e.target.value)}
                  className="w-full h-full p-4 bg-transparent font-mono text-xs leading-relaxed outline-none resize-none text-gray-900 dark:text-gray-100"
                  spellCheck={false}
                />
              ) : (
                <SyntaxHighlighter
                  style={resolvedTheme === "dark" ? vscDarkPlus : vs}
                  language={activeArtifact.language}
                  PreTag="div"
                  showLineNumbers
                  customStyle={{
                    margin: 0,
                    padding: "1.5rem 1rem",
                    background: "transparent",
                    fontSize: "0.85rem",
                  }}
                >
                  {activeCode}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        )}

        {currentTab === "console" && (
          <div className="flex-1 h-full">
            <ArtifactConsole logs={logs} onClear={() => setLogs([])} />
          </div>
        )}

        {currentTab === "diff" && (
          <div className="flex-1 h-full">
            <ArtifactDiffViewer
              originalText={activeArtifact.content}
              modifiedText={editableCode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
