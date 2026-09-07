"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Bot,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  Code,
  Shield,
  Search,
  CheckSquare,
  Sparkles,
  Lock,
} from "lucide-react";
import { WorkflowTemplate, WorkflowEvent } from "@/app/lib/types";
import { getAgentTemplates, streamWorkflow } from "@/app/lib/api/agents";
import { useAuth } from "@/app/lib/context/AuthContext";

interface AgentWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AgentWorkflowModal({ isOpen, onClose }: AgentWorkflowModalProps) {
  const { isAuthenticated, setShowAuthModal, setAuthModalMode } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "pending" | "running" | "complete" | "error">>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, string>>({});
  const [nodeTimings, setNodeTimings] = useState<Record<string, number>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [finalOutput, setFinalOutput] = useState<string>("");
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isOpen) {
      getAgentTemplates()
        .then((data) => {
          setTemplates(data);
          if (data.length > 0 && !selectedTemplate) {
            setSelectedTemplate(data[0]);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleStartWorkflow = async () => {
    if (!selectedTemplate || !inputPrompt.trim() || isRunning) return;

    setIsRunning(true);
    setWorkflowError(null);
    setFinalOutput("");

    // Reset node states
    const initStatus: Record<string, "pending" | "running" | "complete" | "error"> = {};
    selectedTemplate.nodes.forEach((n) => {
      initStatus[n.id] = "pending";
    });
    setNodeStatuses(initStatus);
    setNodeOutputs({});
    setNodeTimings({});
    setSelectedNodeId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamWorkflow(
        {
          template_id: selectedTemplate.id,
          input: inputPrompt.trim(),
        },
        (evt: WorkflowEvent) => {
          if (evt.type === "node_start" && evt.node_id) {
            setNodeStatuses((prev) => ({ ...prev, [evt.node_id!]: "running" }));
            setSelectedNodeId(evt.node_id);
          } else if (evt.type === "node_complete" && evt.node_id) {
            setNodeStatuses((prev) => ({ ...prev, [evt.node_id!]: "complete" }));
            if (evt.output) {
              setNodeOutputs((prev) => ({ ...prev, [evt.node_id!]: evt.output! }));
            }
            if (evt.duration_ms) {
              setNodeTimings((prev) => ({ ...prev, [evt.node_id!]: evt.duration_ms! }));
            }
          } else if (evt.type === "node_error" && evt.node_id) {
            setNodeStatuses((prev) => ({ ...prev, [evt.node_id!]: "error" }));
          } else if (evt.type === "workflow_complete") {
            setIsRunning(false);
            if (evt.final_output) {
              setFinalOutput(evt.final_output);
            }
          } else if (evt.type === "workflow_error") {
            setIsRunning(false);
            setWorkflowError(evt.error || "Workflow error encountered");
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setWorkflowError(err.message || "Failed to execute workflow");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleStopWorkflow = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "planner":
        return <Layers className="w-4 h-4 text-purple-500" />;
      case "researcher":
        return <Search className="w-4 h-4 text-blue-500" />;
      case "coder":
        return <Code className="w-4 h-4 text-emerald-500" />;
      case "reviewer":
        return <Shield className="w-4 h-4 text-amber-500" />;
      case "critic":
        return <CheckSquare className="w-4 h-4 text-indigo-500" />;
      default:
        return <Bot className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-5xl h-[85vh] bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Multi-Agent DAG Workflow Studio
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Collaborative autonomous agents executing directed acyclic graphs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Template & Input Configuration */}
          <div className="w-80 border-r border-[var(--border)] p-4 flex flex-col gap-4 bg-[var(--card)]/40 overflow-y-auto">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                Workflow Template
              </label>
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      if (!isRunning) setSelectedTemplate(tpl);
                    }}
                    disabled={isRunning}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedTemplate?.id === tpl.id
                        ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 shadow-xs"
                        : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="text-xs font-semibold text-gray-900 dark:text-white mb-0.5">
                      {tpl.name}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      <Layers className="w-3 h-3" />
                      <span>{tpl.nodes_count} Agent Nodes</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[140px]">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">
                Initial Objective / Requirement
              </label>
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="e.g., Build a production-grade webhook dispatcher with HMAC verification and retries..."
                className="flex-1 w-full p-3 rounded-xl bg-white dark:bg-[#18181b] border border-[var(--border)] text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
              />
            </div>

            <div>
              {isRunning ? (
                <button
                  onClick={handleStopWorkflow}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Halt Workflow</span>
                </button>
              ) : !isAuthenticated ? (
                <button
                  onClick={() => {
                    setAuthModalMode("login");
                    setShowAuthModal(true);
                  }}
                  className="w-full py-2.5 px-4 bg-purple-600/90 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Sign In to Execute Workflow</span>
                </button>
              ) : (
                <button
                  onClick={handleStartWorkflow}
                  disabled={!inputPrompt.trim()}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>Execute Workflow DAG</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Panel: Interactive DAG Visualizer & Output Inspector */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
            {/* Visual DAG Node Flow */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--card)]/20 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                {selectedTemplate?.nodes.map((node, idx) => {
                  const status = nodeStatuses[node.id] || "pending";
                  const isSelected = selectedNodeId === node.id;
                  const timing = nodeTimings[node.id];

                  return (
                    <div key={node.id} className="flex items-center">
                      <div
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer w-48 ${
                          isSelected
                            ? "ring-2 ring-purple-500 border-transparent shadow-md"
                            : "border-[var(--border)] hover:border-gray-400"
                        } ${
                          status === "running"
                            ? "bg-purple-500/10 border-purple-400 animate-pulse"
                            : status === "complete"
                            ? "bg-emerald-500/10 border-emerald-400/50"
                            : status === "error"
                            ? "bg-red-500/10 border-red-400"
                            : "bg-[var(--card)]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {getRoleIcon(node.role)}
                            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">
                              {node.role}
                            </span>
                          </div>

                          {status === "complete" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          {status === "running" && <Clock className="w-3.5 h-3.5 text-purple-500 animate-spin" />}
                          {status === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>

                        <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {node.name}
                        </div>

                        {timing && (
                          <div className="mt-1 text-[10px] text-gray-400">
                            {timing.toFixed(0)} ms
                          </div>
                        )}
                      </div>

                      {idx < selectedTemplate.nodes.length - 1 && (
                        <ArrowRight className="w-4 h-4 mx-2 text-gray-400 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Node Output Details & Results */}
            <div className="flex-1 overflow-auto p-4 flex flex-col">
              {workflowError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{workflowError}</span>
                </div>
              )}

              {selectedNodeId ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                      Output for: {selectedTemplate?.nodes.find((n) => n.id === selectedNodeId)?.name}
                    </span>
                    {nodeTimings[selectedNodeId] && (
                      <span className="text-xs text-gray-400">
                        Duration: {nodeTimings[selectedNodeId].toFixed(0)}ms
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] font-mono text-xs whitespace-pre-wrap overflow-auto leading-relaxed">
                    {nodeOutputs[selectedNodeId] || (
                      <div className="text-gray-400 italic">
                        {nodeStatuses[selectedNodeId] === "running"
                          ? "Agent is currently reasoning and generating output..."
                          : "Pending execution..."}
                      </div>
                    )}
                  </div>
                </div>
              ) : finalOutput ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>Final Synthesis Deliverable</span>
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-[var(--card)] border border-emerald-500/30 font-mono text-xs whitespace-pre-wrap overflow-auto leading-relaxed">
                    {finalOutput}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs">
                  <Layers className="w-12 h-12 mb-3 opacity-20" />
                  <p>Select a template, provide your objective, and launch the workflow</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
