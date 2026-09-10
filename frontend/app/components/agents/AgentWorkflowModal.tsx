"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  History,
  MessageSquarePlus,
  Trash2,
  Check,
  RotateCcw,
} from "lucide-react";
import { WorkflowTemplate, WorkflowEvent, WorkflowRun } from "@/app/lib/types";
import {
  getAgentTemplates,
  streamWorkflow,
  getWorkflowRuns,
  saveWorkflowRun,
  deleteWorkflowRun,
} from "@/app/lib/api/agents";
import { useAuth } from "@/app/lib/context/AuthContext";
import { useChat } from "@/app/lib/context/ChatContext";

interface AgentWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

export default function AgentWorkflowModal({
  isOpen,
  onClose,
  initialPrompt,
}: AgentWorkflowModalProps) {
  const { isAuthenticated, setShowAuthModal, setAuthModalMode } = useAuth();
  const { appendMessage } = useChat();

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

  // Persistence & History State
  const [pastRuns, setPastRuns] = useState<WorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [copiedToChat, setCopiedToChat] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const runOutputsRef = useRef<Record<string, string>>({});
  const runTimingsRef = useRef<Record<string, number>>({});
  const runStatusesRef = useRef<Record<string, "pending" | "running" | "complete" | "error">>({});

  // Sync initialPrompt from caller
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setInputPrompt(initialPrompt.trim());
    }
  }, [initialPrompt]);

  // Load templates & past runs on open
  useEffect(() => {
    if (!isOpen) return;

    getAgentTemplates()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0 && !selectedTemplate) {
          setSelectedTemplate(data[0]);
        }
      })
      .catch(console.error);

    // Load runs from backend & localStorage fallback
    const loadRuns = async () => {
      let serverRuns: WorkflowRun[] = [];
      try {
        serverRuns = await getWorkflowRuns();
      } catch (e) {
        console.warn("Could not fetch server runs:", e);
      }

      let localRuns: WorkflowRun[] = [];
      try {
        const raw = localStorage.getItem("ai_orchestrator_workflow_runs");
        if (raw) localRuns = JSON.parse(raw);
      } catch {}

      // Merge unique by ID
      const map = new Map<string, WorkflowRun>();
      serverRuns.forEach((r) => map.set(r.id, r));
      localRuns.forEach((r) => {
        if (!map.has(r.id)) map.set(r.id, r);
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setPastRuns(merged);
    };

    loadRuns();
  }, [isOpen]);

  const handleStartWorkflow = async () => {
    if (!selectedTemplate || !inputPrompt.trim() || isRunning) return;

    setIsRunning(true);
    setWorkflowError(null);
    setFinalOutput("");
    setSelectedRunId(null);

    // Reset node states
    const initStatus: Record<string, "pending" | "running" | "complete" | "error"> = {};
    selectedTemplate.nodes.forEach((n) => {
      initStatus[n.id] = "pending";
    });
    setNodeStatuses(initStatus);
    setNodeOutputs({});
    setNodeTimings({});
    setSelectedNodeId(null);

    runOutputsRef.current = {};
    runTimingsRef.current = {};
    runStatusesRef.current = { ...initStatus };

    const controller = new AbortController();
    abortRef.current = controller;

    const startTime = Date.now();

    try {
      await streamWorkflow(
        {
          template_id: selectedTemplate.id,
          input: inputPrompt.trim(),
        },
        async (evt: WorkflowEvent) => {
          if (evt.type === "node_start" && evt.node_id) {
            setNodeStatuses((prev) => ({ ...prev, [evt.node_id!]: "running" }));
            runStatusesRef.current[evt.node_id!] = "running";
            setSelectedNodeId(evt.node_id);
          } else if (evt.type === "node_complete" && evt.node_id) {
            setNodeStatuses((prev) => ({ ...prev, [evt.node_id!]: "complete" }));
            runStatusesRef.current[evt.node_id!] = "complete";
            if (evt.output) {
              setNodeOutputs((prev) => ({ ...prev, [evt.node_id!]: evt.output! }));
              runOutputsRef.current[evt.node_id!] = evt.output!;
            }
            if (evt.duration_ms) {
              setNodeTimings((prev) => ({ ...prev, [evt.node_id!]: evt.duration_ms! }));
              runTimingsRef.current[evt.node_id!] = evt.duration_ms!;
            }
          } else if (evt.type === "node_error" && evt.node_id) {
            setNodeStatuses((prev) => ({ ...prev, [evt.node_id!]: "error" }));
            runStatusesRef.current[evt.node_id!] = "error";
          } else if (evt.type === "workflow_complete") {
            setIsRunning(false);
            const finalOut = evt.final_output || "";
            setFinalOutput(finalOut);

            // Record and save run
            const newRun: WorkflowRun = {
              id: crypto.randomUUID(),
              template_id: selectedTemplate.id,
              template_name: selectedTemplate.name,
              objective: inputPrompt.trim(),
              status: "completed",
              node_outputs: { ...runOutputsRef.current },
              node_timings: { ...runTimingsRef.current },
              final_output: finalOut,
              total_duration_ms: Date.now() - startTime,
              created_at: new Date().toISOString(),
            };

            // Save to backend
            saveWorkflowRun(newRun).catch(console.warn);

            // Save to state and local storage
            setPastRuns((prev) => {
              const updated = [newRun, ...prev.filter((r) => r.id !== newRun.id)].slice(0, 40);
              try {
                localStorage.setItem("ai_orchestrator_workflow_runs", JSON.stringify(updated));
              } catch {}
              return updated;
            });
            setSelectedRunId(newRun.id);
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

  const handleSelectPastRun = (runId: string) => {
    const run = pastRuns.find((r) => r.id === runId);
    if (!run) return;

    setSelectedRunId(run.id);
    setInputPrompt(run.objective);
    setNodeOutputs(run.node_outputs || {});
    setNodeTimings(run.node_timings || {});
    setFinalOutput(run.final_output || "");
    setSelectedNodeId(null);
    setWorkflowError(null);

    // Match template
    const matched = templates.find((t) => t.id === run.template_id);
    if (matched) {
      setSelectedTemplate(matched);
      const statuses: Record<string, "pending" | "running" | "complete" | "error"> = {};
      matched.nodes.forEach((n) => {
        statuses[n.id] = run.node_outputs?.[n.id] ? "complete" : "pending";
      });
      setNodeStatuses(statuses);
    }
  };

  const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteWorkflowRun(runId).catch(console.warn);

    setPastRuns((prev) => {
      const updated = prev.filter((r) => r.id !== runId);
      try {
        localStorage.setItem("ai_orchestrator_workflow_runs", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (selectedRunId === runId) {
      setSelectedRunId(null);
    }
  };

  const handleContinueInChat = async () => {
    if (!finalOutput && Object.keys(nodeOutputs).length === 0) return;

    let formatted = `# ⚡ Multi-Agent Swarm Deliverable: ${selectedTemplate?.name || "Workflow"}\n\n`;
    formatted += `**Objective:** ${inputPrompt}\n\n`;

    if (selectedTemplate?.nodes) {
      selectedTemplate.nodes.forEach((n) => {
        const out = nodeOutputs[n.id];
        const timing = nodeTimings[n.id];
        if (out) {
          formatted += `### 🤖 [${n.name}] (${n.role.toUpperCase()}) ${timing ? `· ${timing.toFixed(0)}ms` : ""}\n\n${out}\n\n---\n\n`;
        }
      });
    }

    if (finalOutput) {
      formatted += `### 🎯 Final Evaluation & Synthesis\n\n${finalOutput}\n`;
    }

    await appendMessage("assistant", formatted, `Multi-Agent: ${selectedTemplate?.name || "Workflow"}`);
    setCopiedToChat(true);
    setTimeout(() => setCopiedToChat(false), 2500);
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
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)] bg-[var(--card)] gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                  Agent Operations Studio
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold shrink-0">
                  DAG Swarm
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Directed acyclic graph collaborative autonomous agent execution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Previous Runs Selector */}
            {pastRuns.length > 0 && (
              <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-xl px-2.5 py-1">
                <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <select
                  value={selectedRunId || ""}
                  onChange={(e) => handleSelectPastRun(e.target.value)}
                  className="bg-transparent text-xs font-medium text-gray-700 dark:text-gray-300 outline-none max-w-[180px] sm:max-w-[220px] truncate cursor-pointer"
                  title="Load a previous workflow execution"
                >
                  <option value="" className="bg-white dark:bg-[#18181b]">
                    📜 Previous Runs ({pastRuns.length})
                  </option>
                  {pastRuns.map((r) => (
                    <option key={r.id} value={r.id} className="bg-white dark:bg-[#18181b]">
                      {new Date(r.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {r.template_name} ({r.objective.slice(0, 24)}...)
                    </option>
                  ))}
                </select>

                {selectedRunId && (
                  <button
                    onClick={(e) => handleDeleteRun(selectedRunId, e)}
                    className="p-1 hover:text-red-500 text-gray-400 rounded transition-colors"
                    title="Delete this saved run"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Template & Input Configuration */}
          <div className="w-80 border-r border-[var(--border)] p-4 flex flex-col gap-4 bg-[var(--card)]/40 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Workflow Template
                </label>
                {selectedRunId && (
                  <button
                    onClick={() => {
                      setSelectedRunId(null);
                      setFinalOutput("");
                      setNodeOutputs({});
                      setNodeTimings({});
                    }}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>New Run</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      if (!isRunning) {
                        setSelectedTemplate(tpl);
                        setSelectedRunId(null);
                      }
                    }}
                    disabled={isRunning}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
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
                Objective / Requirement
              </label>
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="e.g., Build a production-grade webhook dispatcher with HMAC verification and retries..."
                className="flex-1 w-full p-3 rounded-xl bg-white dark:bg-[#18181b] border border-[var(--border)] text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
              />
            </div>

            <div className="space-y-2">
              {isRunning ? (
                <button
                  onClick={handleStopWorkflow}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
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

              {/* Continue in Chat Button */}
              {(finalOutput || Object.keys(nodeOutputs).length > 0) && (
                <button
                  type="button"
                  onClick={handleContinueInChat}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  {copiedToChat ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saved to Chat Session!</span>
                    </>
                  ) : (
                    <>
                      <MessageSquarePlus className="w-4 h-4" />
                      <span>💬 Continue in Chat</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Panel: Interactive DAG Visualizer & Output Inspector */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)]">
            {/* Historical Run Banner */}
            {selectedRunId && (
              <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between text-xs text-purple-700 dark:text-purple-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <History className="w-3.5 h-3.5" />
                  Viewing saved historical execution
                </span>
                <span className="text-[11px] opacity-75">
                  Click any node below to inspect agent output
                </span>
              </div>
            )}

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
