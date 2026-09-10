"use client";

import React, { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Code,
  Search,
  Shield,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { ToolStepEvent } from "@/app/lib/types";

interface AgentSwarmCardProps {
  steps: ToolStepEvent[];
  isGenerating?: boolean;
}

export default function AgentSwarmCard({ steps, isGenerating }: AgentSwarmCardProps) {
  const [isSwarmExpanded, setIsSwarmExpanded] = useState(true);
  const [expandedAgentIndex, setExpandedAgentIndex] = useState<number | null>(null);

  interface AgentNodeProgress {
    role: string;
    nodeName: string;
    status: "running" | "complete" | "error";
    durationMs?: number;
    output?: string;
  }

  const agentNodes: AgentNodeProgress[] = [];

  steps.forEach((s) => {
    if (!s.tool || !s.tool.startsWith("agent:")) return;

    const rawRole = s.tool.replace("agent:", "").toLowerCase();
    const nodeName = s.input?.node || rawRole.charAt(0).toUpperCase() + rawRole.slice(1);

    const existing = agentNodes.find((n) => n.role === rawRole || n.nodeName === nodeName);

    if (s.type === "tool_start") {
      if (!existing) {
        agentNodes.push({
          role: rawRole,
          nodeName,
          status: "running",
        });
      } else {
        existing.status = "running";
      }
    } else if (s.type === "tool_result") {
      if (existing) {
        existing.status = "complete";
        existing.durationMs = s.elapsed_ms;
        existing.output = typeof s.result === "string" ? s.result : JSON.stringify(s.result, null, 2);
      } else {
        agentNodes.push({
          role: rawRole,
          nodeName,
          status: "complete",
          durationMs: s.elapsed_ms,
          output: typeof s.result === "string" ? s.result : JSON.stringify(s.result, null, 2),
        });
      }
    } else if (s.type === "error") {
      if (existing) {
        existing.status = "error";
      }
    }
  });

  if (agentNodes.length === 0) return null;

  const totalDuration = agentNodes.reduce((acc, n) => acc + (n.durationMs || 0), 0);
  const allComplete = agentNodes.every((n) => n.status === "complete");

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "planner":
        return <Layers className="w-3.5 h-3.5 text-purple-500" />;
      case "researcher":
        return <Search className="w-3.5 h-3.5 text-blue-500" />;
      case "coder":
        return <Code className="w-3.5 h-3.5 text-emerald-500" />;
      case "reviewer":
        return <Shield className="w-3.5 h-3.5 text-amber-500" />;
      case "critic":
        return <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />;
      default:
        return <Bot className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const getRoleTitle = (role: string) => {
    switch (role) {
      case "planner":
        return "Architect Agent";
      case "researcher":
        return "Researcher Agent";
      case "coder":
        return "Lead Coder Agent";
      case "reviewer":
        return "Security Auditor";
      case "critic":
        return "Synthesis Critic";
      default:
        return `${role.charAt(0).toUpperCase() + role.slice(1)} Agent`;
    }
  };

  return (
    <div className="my-2.5 rounded-2xl border border-purple-200 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/40 via-white to-purple-50/20 dark:from-purple-950/20 dark:via-[#18181b] dark:to-purple-950/10 text-xs overflow-hidden transition-all shadow-xs">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsSwarmExpanded(!isSwarmExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                Multi-Agent Swarm Orchestration
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                {agentNodes.length} Agents
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {totalDuration > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
              <Clock className="w-3 h-3" />
              {(totalDuration / 1000).toFixed(1)}s
            </span>
          )}

          {allComplete ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              Swarm Complete
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md animate-pulse">
              <Clock className="w-3 h-3 animate-spin" />
              Reasoning...
            </span>
          )}

          {isSwarmExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Stepper Body */}
      {isSwarmExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-purple-100 dark:border-purple-900/30 space-y-1.5">
          {agentNodes.map((agent, idx) => {
            const isAgentExpanded = expandedAgentIndex === idx;

            return (
              <div
                key={idx}
                className="rounded-xl border border-[var(--border)] bg-white/60 dark:bg-white/[0.02] overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setExpandedAgentIndex(isAgentExpanded ? null : idx)}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1 rounded-md bg-black/5 dark:bg-white/5">
                      {getRoleIcon(agent.role)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>{getRoleTitle(agent.role)}</span>
                        <span className="text-[10px] text-gray-400 font-normal truncate">
                          ({agent.nodeName})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {agent.durationMs !== undefined && (
                      <span className="text-[10px] text-gray-400 font-mono">
                        {agent.durationMs.toFixed(0)}ms
                      </span>
                    )}

                    {agent.status === "complete" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    {agent.status === "running" && (
                      <Clock className="w-3.5 h-3.5 text-purple-500 animate-spin shrink-0" />
                    )}
                    {agent.status === "error" && (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}

                    {agent.output && (
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 underline ml-1 cursor-pointer">
                        {isAgentExpanded ? "Hide" : "Inspect"}
                      </span>
                    )}
                  </div>
                </button>

                {isAgentExpanded && agent.output && (
                  <div className="p-3 border-t border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02]">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Intermediate Output & Reasoning:
                    </div>
                    <pre className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 font-mono text-[11px] text-gray-800 dark:text-gray-200 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {agent.output}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
