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

  return (
    <div className="my-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs overflow-hidden transition-all shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-1.5 rounded-lg ${
              isAgent
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                : (meta?.color || "bg-blue-500/10 text-blue-600 dark:text-blue-400")
            }`}
          >
            {isAgent ? <Bot className="w-3.5 h-3.5" /> : (meta?.icon || <Wrench className="w-3.5 h-3.5" />)}
          </div>
          <span className="font-semibold text-gray-900 dark:text-white truncate">
            {displayName}
          </span>
          {step.elapsed_ms !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              {step.elapsed_ms}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running...
            </span>
          )}
          {isComplete && !isError && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              Complete
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-[var(--border)] space-y-2.5 font-mono text-[11px]">
          {/* Input Preview */}
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <div className="text-[10px] font-sans font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Input Parameters
              </div>
              {step.input.code ? (
                <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                  {step.input.code}
                </pre>
              ) : step.input.expression ? (
                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-blue-600 dark:text-blue-400 font-bold">
                  {step.input.expression}
                </div>
              ) : step.input.query ? (
                <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-purple-600 dark:text-purple-400">
                  {step.input.query}
                </div>
              ) : (
                <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Output Result */}
          {resultContent && (
            <div>
              <div className="text-[10px] font-sans font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Execution Output
              </div>
              <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {resultContent}
              </pre>
            </div>
          )}

          {/* Error Message */}
          {step.message && (
            <div className="text-rose-600 dark:text-rose-400 p-2 rounded-lg bg-rose-500/10">
              {step.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
