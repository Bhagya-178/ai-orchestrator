"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Bot, User } from "lucide-react";
import { ChatMessage } from "@/app/lib/types";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} w-full group`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mt-1">
          <Bot className="w-5 h-5 text-gray-600" />
        </div>
      )}
      
      <div className={`flex flex-col gap-1 max-w-[min(100%,800px)] ${isUser ? "items-end" : "items-start"}`}>
        <div 
          className={`
            px-5 py-3.5 rounded-2xl
            ${isUser 
              ? "bg-gray-100 text-gray-900 rounded-br-sm" 
              : "bg-white text-gray-900 border border-[var(--border)] shadow-sm rounded-bl-sm w-full"
            }
          `}
        >
          {message.content ? (
            <div className={`prose prose-sm md:prose-base max-w-none ${isUser ? "" : "prose-slate"}`}>
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");
                    
                    if (!inline && match) {
                      return (
                        <div className="code-block group/code relative my-4">
                          <div className="absolute left-0 top-0 w-full px-4 py-1.5 bg-[#1e1e1e] border-b border-gray-700 text-gray-400 text-xs font-mono rounded-t-lg flex justify-between items-center">
                            <span>{match[1]}</span>
                            <button
                              onClick={() => handleCopy(codeString)}
                              className="text-gray-400 hover:text-white transition-colors"
                              aria-label="Copy code"
                            >
                              {copiedCode === codeString ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <div className="pt-8 bg-[#1e1e1e] rounded-lg overflow-hidden">
                            <SyntaxHighlighter
                              style={vscDarkPlus as any}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ margin: 0, padding: "1rem", background: "transparent", fontSize: "0.85rem" }}
                              {...props}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <code className="bg-black/5 rounded-md px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
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
        
        {!isUser && message.model && (
          <div className="text-[11px] text-gray-400 px-2 mt-1 font-medium flex items-center gap-1.5">
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
