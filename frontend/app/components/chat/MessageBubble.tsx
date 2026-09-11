"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, FileText, Edit3, RotateCw, Sparkles, X, ArrowUp } from "lucide-react";
import { ChatMessage } from "@/app/lib/types";
import { useTheme } from "@/app/lib/context/ThemeContext";
import { useChat } from "@/app/lib/context/ChatContext";
import { useArtifact } from "@/app/lib/context/ArtifactContext";
import ToolExecutionCard from "../tools/ToolExecutionCard";
import AgentSwarmCard from "../agents/AgentSwarmCard";

const MessageBubble = React.memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || "");

  const { resolvedTheme } = useTheme();
  const { editMessage, regenerateLastResponse, isGenerating } = useChat();
  const { openArtifact } = useArtifact();

  const codeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

  const handleCopyCode = useCallback((code: string) => {
    if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current);
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    codeTimeoutRef.current = setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const handleCopyMessage = useCallback(async () => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopiedMessage(true);
      messageTimeoutRef.current = setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message.content || "";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedMessage(true);
        messageTimeoutRef.current = setTimeout(() => setCopiedMessage(false), 2000);
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
  }, [message.content]);

  const handleSaveEdit = async () => {
    if (!editText.trim() || isGenerating) return;
    setIsEditing(false);
    await editMessage(message.id, editText.trim());
  };

  const components = useMemo(
    () => ({
      code({ className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "");
        const code = String(children).replace(/\n$/, "");

        if (match) {
          const lang = match[1].toLowerCase();
          const isCanvasEligible = [
            "html", "svg", "jsx", "tsx", "react",
            "mermaid", "python", "py", "javascript", "js",
          ].includes(lang);

          return (
            <div className="relative group/code mt-3 mb-3 rounded-xl overflow-hidden border border-[var(--border)] bg-[#fafafa] dark:bg-[#0d0d0d]">
              {/* Code block header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--border-subtle)] dark:bg-[#141414]">
                <span className="text-[11px] font-mono text-[var(--muted)] font-medium">
                  {match[1]}
                </span>
                <div className="flex items-center gap-1.5">
                  {isCanvasEligible && (
                    <button
                      onClick={() =>
                        openArtifact({
                          id: `art-${Math.random().toString(36).substring(2, 8)}`,
                          title: `${match[1].toUpperCase()} Component`,
                          type:
                            lang === "html"
                              ? "html"
                              : lang === "svg"
                              ? "svg"
                              : lang === "mermaid"
                              ? "mermaid"
                              : "code",
                          language: lang,
                          content: code,
                        })
                      }
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                      title="Open in Canvas"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Canvas</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleCopyCode(code)}
                    className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded"
                    title="Copy code"
                  >
                    {copiedCode === code ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <SyntaxHighlighter
                style={resolvedTheme === "dark" ? vscDarkPlus : vs}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  background: "transparent",
                  padding: "0.9rem 1rem",
                  fontSize: "0.8rem",
                  lineHeight: "1.6",
                }}
                {...props}
              >
                {code}
              </SyntaxHighlighter>
            </div>
          );
        }

        return (
          <code
            className="bg-black/6 dark:bg-white/10 rounded px-1.5 py-0.5 font-mono text-[0.85em] border border-black/5 dark:border-white/10"
            {...props}
          >
            {children}
          </code>
        );
      },
    }),
    [resolvedTheme, copiedCode, handleCopyCode, openArtifact]
  );

  return (
    <div className={`flex gap-3 w-full group ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {!isUser ? (
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mt-0.5 shadow-sm">
          <span className="text-white font-bold text-[10px] tracking-tight">AI</span>
        </div>
      ) : null}

      {/* Message content */}
      <div
        className={`flex flex-col gap-1 ${
          isUser ? "items-end max-w-[min(85%,600px)]" : "items-start flex-1 min-w-0"
        }`}
      >
        <div
          className={`
            rounded-2xl text-sm leading-relaxed
            ${
              isUser
                ? "bg-[var(--user-bubble)] text-[var(--foreground)] px-4 py-3 rounded-br-sm"
                : "bg-transparent text-[var(--foreground)] w-full px-0 py-0"
            }
          `}
        >
          {/* Document attachment badge */}
          {message.attachedDocument && (
            <div className="flex items-center gap-2.5 p-2.5 mb-3 bg-[var(--card)] border border-[var(--border)] rounded-xl max-w-xs shadow-sm">
              <div className="w-8 h-8 shrink-0 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--foreground)] truncate">
                  {message.attachedDocument.filename}
                </p>
                <p className="text-[11px] text-[var(--muted)]">Document attached</p>
              </div>
            </div>
          )}

          {/* Edit mode */}
          {isEditing ? (
            <div className="flex flex-col gap-2 w-full min-w-[260px] sm:min-w-[400px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none transition-all"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isGenerating || !editText.trim()}
                  className="px-3 py-1.5 text-xs bg-[var(--foreground)] text-[var(--background)] font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 disabled:opacity-40"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Save & Resubmit</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tool steps (swarm / react) */}
              {message.toolSteps && message.toolSteps.length > 0 &&
                (() => {
                  const agentSteps = message.toolSteps.filter((s) =>
                    s.tool?.startsWith("agent:")
                  );
                  const otherSteps = message.toolSteps.filter(
                    (s) => !s.tool?.startsWith("agent:")
                  );
                  return (
                    <div className="flex flex-col gap-2 mb-3 w-full">
                      {agentSteps.length > 0 && (
                        <AgentSwarmCard steps={agentSteps} isGenerating={isGenerating} />
                      )}
                      {otherSteps.map((step, idx) => (
                        <ToolExecutionCard key={idx} step={step} />
                      ))}
                    </div>
                  );
                })()}

              {/* Main content */}
              {message.content ? (
                <div
                  className={`prose prose-sm md:prose-base max-w-none dark:prose-invert ${
                    isUser
                      ? ""
                      : "prose-slate dark:prose-p:text-gray-300"
                  }`}
                >
                  <ReactMarkdown components={components}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                /* Typing indicator */
                <div className="flex items-center gap-1 py-1 h-6">
                  <div
                    className="w-1.5 h-1.5 bg-[var(--muted)] rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-[var(--muted)] rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-1.5 h-1.5 bg-[var(--muted)] rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Action row — appears on hover */}
        {!isEditing && (
          <div
            className={`flex items-center gap-1.5 px-1 mt-0.5 z-10 ${
              isUser ? "flex-row-reverse" : ""
            }`}
          >
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              {/* Copy */}
              <button
                onClick={handleCopyMessage}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/8"
                title="Copy"
              >
                {copiedMessage ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Edit (user only) */}
              {isUser && (
                <button
                  onClick={() => {
                    setEditText(message.content);
                    setIsEditing(true);
                  }}
                  className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/8"
                  title="Edit"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Regenerate (assistant only) */}
              {!isUser && (
                <button
                  onClick={regenerateLastResponse}
                  disabled={isGenerating}
                  className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/8 disabled:opacity-30"
                  title="Regenerate"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {/* Model + latency badge (assistant only) */}
            {!isUser && message.model && (
              <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
                <span className="font-mono bg-black/5 dark:bg-white/8 px-1.5 py-0.5 rounded text-[10px] border border-[var(--border)]">
                  {message.model}
                </span>
                {message.latencyMs && (
                  <span>· {(message.latencyMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-[var(--muted)] pl-3 border-l-2 border-[var(--border)] py-1">
            <div className="font-medium text-[var(--foreground)] mb-1 flex items-center gap-1.5">
              <span>Sources</span>
              <span className="bg-black/5 dark:bg-white/8 px-1.5 py-0.5 rounded-full text-[10px]">
                {message.sources.length}
              </span>
            </div>
            <ul className="space-y-0.5">
              {message.sources.map((src, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="opacity-40 mt-0.5">▸</span>
                  <span>
                    {src.label}
                    {src.page ? ` · Page ${src.page}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
