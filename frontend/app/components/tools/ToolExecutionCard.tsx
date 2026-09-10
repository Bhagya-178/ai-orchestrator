"use client";

import React, { useState } from "react";
import { Wrench, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, Bot } from "lucide-react";
import { ToolStepEvent } from "@/app/lib/types";

interface ToolExecutionCardProps {
  step: ToolStepEvent;
}

export default function ToolExecutionCard({ step }: ToolExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isComplete = Boolean(step.result);
  const isError = Boolean(step.message && step.type === "error");
  const isAgent = Boolean(step.tool?.startsWith("agent:"));
  const cleanToolName = isAgent ? step.tool!.replace("agent:", "") : (step.tool || "tool");

  return (
    <div className="my-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs overflow-hidden transition-all shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-1.5 rounded-lg ${isAgent ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
            {isAgent ? <Bot className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
          </div>
          <span className="font-semibold text-gray-900 dark:text-white truncate">
            {isAgent ? "Agent: " : "Tool Call: "}
            <span className={`font-mono ${isAgent ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-blue-600 dark:text-blue-400'}`}>
              {cleanToolName}
            </span>
          </span>
          {step.elapsed_ms !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3" />
              {step.elapsed_ms}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-[var(--border)] space-y-2.5 font-mono text-[11px]">
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <div className="text-[10px] font-sans font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Input Parameters
              </div>
              <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}

          {step.result && (
            <div>
              <div className="text-[10px] font-sans font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Output Result
              </div>
              <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {typeof step.result === "string" ? step.result : JSON.stringify(step.result, null, 2)}
              </pre>
            </div>
          )}

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
