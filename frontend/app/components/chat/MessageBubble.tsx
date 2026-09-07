"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Bot, FileText, Edit3, RotateCw, Sparkles, X, ArrowUp } from "lucide-react";
import { ChatMessage } from "@/app/lib/types";
import { useTheme } from "@/app/lib/context/ThemeContext";
import { useChat } from "@/app/lib/context/ChatContext";
import { useArtifact } from "@/app/lib/context/ArtifactContext";
import SpeechPlayer from "../voice/SpeechPlayer";
import ToolExecutionCard from "../tools/ToolExecutionCard";

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
    } catch (err) {
      console.error("Clipboard API failed:", err);
      const textArea = document.createElement("textarea");
      textArea.value = message.content || "";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedMessage(true);
        messageTimeoutRef.current = setTimeout(() => setCopiedMessage(false), 2000);
      } catch (e) {
        console.error("Fallback copy failed:", e);
      }
      document.body.removeChild(textArea);
    }
  }, [message.content]);

  const handleSaveEdit = async () => {
    if (!editText.trim() || isGenerating) return;
    setIsEditing(false);
    await editMessage(message.id, editText.trim());
  };

  const components = useMemo(() => ({
    code({ className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || "");
      const code = String(children).replace(/\n$/, "");
      
      if (match) {
        const lang = match[1].toLowerCase();
        const isCanvasEligible = ["html", "svg", "jsx", "tsx", "react", "mermaid", "python", "py", "javascript", "js"].includes(lang);

        return (
          <div className="relative group/code mt-4 mb-4 rounded-xl overflow-hidden bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 shadow-xs">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 font-medium">{match[1]}</span>
              
              <div className="flex items-center gap-1.5">
                {isCanvasEligible && (
                  <button
                    onClick={() => openArtifact({
                      id: `art-${Math.random().toString(36).substring(2, 8)}`,
                      title: `${match[1].toUpperCase()} Component`,
                      type: lang === "html" ? "html" : lang === "svg" ? "svg" : lang === "mermaid" ? "mermaid" : "code",
                      language: lang,
                      content: code,
                    })}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                    title="Open in Claude Artifact Canvas"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Canvas</span>
                  </button>
                )}

                <button
                  onClick={() => handleCopyCode(code)}
                  className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded"
                  title="Copy code"
                >
                  {copiedCode === code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
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
                padding: "1rem",
                fontSize: "0.85rem",
              }}
              {...props}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        );
      }
      return (
        <code className="bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
          {children}
        </code>
      );
    }
  }), [resolvedTheme, copiedCode, handleCopyCode, openArtifact]);

  return (
    <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} w-full group`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center mt-1 bg-white dark:bg-transparent shadow-xs">
          <Bot className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </div>
      )}
      
      <div className={`flex flex-col gap-1 max-w-[min(100%,800px)] ${isUser ? "items-end" : "items-start"}`}>
        <div 
          className={`
            px-5 py-3.5 rounded-2xl
            ${isUser 
              ? "bg-[#f4f4f5] dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-br-sm" 
              : "bg-transparent text-gray-900 dark:text-gray-100 w-full"
            }
          `}
        >
          {message.attachedDocument && (
            <div className="flex items-center gap-3 p-3 mb-3 bg-white dark:bg-[#27272a] border border-gray-200 dark:border-white/10 rounded-xl max-w-sm">
              <div className="w-10 h-10 shrink-0 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {message.attachedDocument.filename}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Document attached
                </p>
              </div>
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2 w-full min-w-[280px] sm:min-w-[420px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full bg-white dark:bg-[#222] border border-[var(--border)] rounded-xl p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isGenerating || !editText.trim()}
                  className="px-3 py-1.5 text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 shadow-xs"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Save & Submit</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.toolSteps && message.toolSteps.length > 0 && (
                <div className="flex flex-col gap-2 mb-3 w-full">
                  {message.toolSteps.map((step, idx) => (
                    <ToolExecutionCard key={idx} step={step} />
                  ))}
                </div>
              )}
              {message.content ? (
                <div className={`prose prose-sm md:prose-base max-w-none dark:prose-invert ${isUser ? "" : "prose-slate dark:prose-p:text-gray-300"}`}>
                  <ReactMarkdown components={components}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-1 h-6">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Action Row */}
        {!isEditing && (
          <div className={`flex items-center gap-2 px-2 mt-1 relative z-10 ${isUser ? "flex-row-reverse" : ""}`}>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                onClick={handleCopyMessage}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                title="Copy message"
              >
                {copiedMessage ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Edit button for user messages */}
              {isUser && (
                <button
                  onClick={() => {
                    setEditText(message.content);
                    setIsEditing(true);
                  }}
                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                  title="Edit prompt"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Read Aloud and Regenerate buttons for assistant responses */}
              {!isUser && (
                <>
                  <SpeechPlayer text={message.content} />
                  <button
                    onClick={regenerateLastResponse}
                    disabled={isGenerating}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30"
                    title="Regenerate response"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                  </button>
                </>
              )}
            </div>
            
            {!isUser && message.model && (
              <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
                <span>{message.model}</span>
                {message.latencyMs && (
                  <>
                    <span>·</span>
                    <span>{(message.latencyMs / 1000).toFixed(1)}s</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-l-2 border-gray-200 dark:border-white/10 pl-3 py-1">
            <div className="font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <span>Sources</span>
              <span className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full text-[10px]">{message.sources.length}</span>
            </div>
            <ul className="space-y-1">
              {message.sources.map((src, i) => (
                <li key={i} className="flex items-start gap-1.5 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer">
                  <span className="opacity-50 mt-0.5">▸</span>
                  <span>{src.label} {src.page ? `· Page ${src.page}` : ""}</span>
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
