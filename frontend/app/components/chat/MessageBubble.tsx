"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Bot, User, FileText } from "lucide-react";
import { ChatMessage } from "@/app/lib/types";

import { useTheme } from "@/app/lib/context/ThemeContext";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const { resolvedTheme } = useTheme();

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch (err) {
      console.error("Clipboard API failed:", err);
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = message.content || "";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2000);
      } catch (e) {
        console.error("Fallback copy failed:", e);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} w-full group`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center mt-1 bg-white dark:bg-transparent">
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
                  Document uploaded
                </p>
              </div>
            </div>
          )}
          {message.content ? (
            <div className={`prose prose-sm md:prose-base max-w-none dark:prose-invert ${isUser ? "" : "prose-slate dark:prose-p:text-gray-300"}`}>
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const code = String(children).replace(/\n$/, "");
                    
                    if (match) {
                      return (
                        <div className="relative group/code mt-4 mb-4 rounded-md overflow-hidden bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10">
                          <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/5">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{match[1]}</span>
                            <button
                              onClick={() => handleCopyCode(code)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                              title="Copy code"
                            >
                              {copiedCode === code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <SyntaxHighlighter
                            style={resolvedTheme === "dark" ? vscDarkPlus : vs}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              background: "transparent",
                              padding: "1rem",
                              fontSize: "0.875rem",
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
                }}
              >
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
        </div>
        
        {/* Action Row */}
        <div className={`flex items-center gap-3 px-2 mt-1 relative z-10 ${isUser ? "flex-row-reverse" : ""}`}>
          <div className="opacity-40 hover:opacity-100 transition-opacity flex items-center">
            <button
              onClick={handleCopyMessage}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/10"
              title="Copy message"
            >
              {copiedMessage ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          {!isUser && message.model && (
            <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1.5">
              <span>Automatically routed</span>
              <span>·</span>
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

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 border-l-2 border-gray-200 pl-3 py-1">
            <div className="font-medium text-gray-600 mb-1 flex items-center gap-1.5">
              <span>Sources</span>
              <span className="bg-black/5 px-1.5 py-0.5 rounded-full text-[10px]">{message.sources.length}</span>
            </div>
            <ul className="space-y-1">
              {message.sources.map((src, i) => (
                <li key={i} className="flex items-start gap-1.5 hover:text-gray-700 cursor-pointer">
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
}
