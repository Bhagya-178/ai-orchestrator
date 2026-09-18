"use client";

import React, { useState } from "react";
import {
  Wrench,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  Terminal,
  Calculator,
  Calendar,
  Globe,
  Folder,
  Database,
  Sigma,
  BarChart2,
  FileText,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { ToolStepEvent } from "@/app/lib/types";

interface ToolExecutionCardProps {
  step: ToolStepEvent;
}

const TOOL_META: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  calculator: {
    name: "Calculator",
    icon: <Calculator className="w-3.5 h-3.5" />,
    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  datetime: {
    name: "Date & Time",
    icon: <Calendar className="w-3.5 h-3.5" />,
    color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  code_runner: {
    name: "Python Code Runner",
    icon: <Terminal className="w-3.5 h-3.5" />,
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  file_system: {
    name: "File System",
    icon: <Folder className="w-3.5 h-3.5" />,
    color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
  },
  web_search: {
    name: "Web Search",
    icon: <Globe className="w-3.5 h-3.5" />,
    color: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
  },
  web_scraper: {
    name: "Web Scraper",
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
  },
  math_tool: {
    name: "Advanced Math Engine",
    icon: <Sigma className="w-3.5 h-3.5" />,
    color: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
  },
  sql_tool: {
    name: "SQL Database",
    icon: <Database className="w-3.5 h-3.5" />,
    color: "text-orange-600 dark:text-orange-400 bg-orange-500/10",
  },
  chart_tool: {
    name: "Chart Generator",
    icon: <BarChart2 className="w-3.5 h-3.5" />,
    color: "text-pink-600 dark:text-pink-400 bg-pink-500/10",
  },
};

export default function ToolExecutionCard({ step }: ToolExecutionCardProps) {
  // If no tool name and no result/input, guard against rendering a blank phantom card
  if (!step.tool && !step.input && step.result === undefined) {
    return null;
  }

  const rawTool = (step.tool || "").toLowerCase();
  const isAgent = rawTool.startsWith("agent:");
  const cleanId = isAgent ? rawTool.replace("agent:", "") : rawTool;
  const meta = TOOL_META[cleanId];

  const displayName = isAgent
    ? `Agent: ${cleanId.charAt(0).toUpperCase() + cleanId.slice(1)}`
    : (meta?.name || cleanId || "External Tool");

  const isComplete = step.result !== undefined;
  const isError = Boolean(step.message && (step.type === "error" || step.type === "tool_error"));
  const isRunning = !isComplete && !isError;

  const [isExpanded, setIsExpanded] = useState<boolean>(isRunning);
  const [copiedOutput, setCopiedOutput] = useState(false);

  const formatResultContent = (res: any): string => {
    if (res === null || res === undefined) return "";
    if (typeof res === "string") return res;
    if (typeof res === "object") {
      // If tool response is wrapped with result or error
      if (res.result !== undefined && res.result !== null) {
        return typeof res.result === "string" ? res.result : JSON.stringify(res.result, null, 2);
      }
      if (res.error) return `Error: ${res.error}`;
      return JSON.stringify(res, null, 2);
    }
    return String(res);
  };

  const resultContent = formatResultContent(step.result);

  const handleCopyOutput = () => {
    if (!resultContent) return;
    navigator.clipboard.writeText(resultContent);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-xl border border-neutral-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/90 text-xs overflow-hidden transition-all shadow-2xs hover:border-neutral-300 dark:hover:border-zinc-700/80">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-50/70 dark:bg-zinc-950/40 hover:bg-neutral-100/80 dark:hover:bg-zinc-800/40 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              isAgent
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                : (meta?.color || "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20")
            }`}
          >
            {isAgent ? <Bot className="w-3.5 h-3.5" /> : (meta?.icon || <Wrench className="w-3.5 h-3.5" />)}
          </div>
          <span className="font-semibold text-neutral-900 dark:text-zinc-100 truncate text-[12px]">
            {displayName}
          </span>
          {step.elapsed_ms !== undefined && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 dark:text-zinc-400 bg-neutral-100 dark:bg-zinc-800/80 border border-neutral-200/80 dark:border-zinc-700/60 px-1.5 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              {step.elapsed_ms}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 rounded-md animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </span>
          )}
          {isComplete && !isError && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              Complete
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 rounded-md">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400 dark:text-zinc-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-neutral-200/80 dark:border-zinc-800/80 bg-neutral-50/40 dark:bg-zinc-950/40 space-y-3 font-mono text-[11px]">
          {/* Input Preview */}
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <div className="text-[10px] font-sans font-semibold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Input Parameters
              </div>
              {step.input.code ? (
                <pre className="p-2.5 rounded-lg bg-neutral-100/90 dark:bg-zinc-900/90 border border-neutral-200/80 dark:border-zinc-800/80 text-neutral-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-2xs">
                  {step.input.code}
                </pre>
              ) : step.input.expression ? (
                <div className="p-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                  {step.input.expression}
                </div>
              ) : step.input.query ? (
                <div className="p-2 rounded-lg bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/40 text-purple-700 dark:text-purple-300">
                  {step.input.query}
                </div>
              ) : (
                <pre className="p-2.5 rounded-lg bg-neutral-100/90 dark:bg-zinc-900/90 border border-neutral-200/80 dark:border-zinc-800/80 text-neutral-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-2xs">
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Output Result */}
          {resultContent && (
            <div>
              <div className="text-[10px] font-sans font-semibold text-neutral-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Execution Output</span>
                <button
                  type="button"
                  onClick={handleCopyOutput}
                  className="flex items-center gap-1 text-[10px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Copy output"
                >
                  {copiedOutput ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-neutral-100/90 dark:bg-zinc-900/90 border border-neutral-200/80 dark:border-zinc-800/80 text-neutral-800 dark:text-zinc-200 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-2xs">
                {resultContent}
              </pre>
            </div>
          )}

          {/* Error Message */}
          {step.message && (
            <div className="text-rose-700 dark:text-rose-400 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 text-[11px] leading-relaxed">
              {step.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
