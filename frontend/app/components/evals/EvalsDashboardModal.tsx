"use client";

import { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Play,
  Clock,
  Sparkles,
  Award,
  BarChart,
  Layers,
  HelpCircle,
  Lock,
  Edit3,
  List,
  Cpu,
} from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";
import { BenchmarkInfo, EvalRunSummary, EvalRunDetail } from "@/app/lib/types";
import { listBenchmarks, runBenchmark, listEvalHistory, getEvalDetail } from "@/app/lib/api/evals";
import { getAvailableModels } from "@/app/lib/api/health";

interface EvalsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels?: string[];
}

export default function EvalsDashboardModal({ isOpen, onClose, availableModels }: EvalsDashboardModalProps) {
  const { isAuthenticated, setShowAuthModal, setAuthModalMode } = useAuth();
  const [benchmarks, setBenchmarks] = useState<BenchmarkInfo[]>([]);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>("");
  const [modelList, setModelList] = useState<string[]>([]);
  const [targetModel, setTargetModel] = useState("qwen2.5:1.5b");
  const [judgeModel, setJudgeModel] = useState("qwen3:8b");
  const [isCustomTarget, setIsCustomTarget] = useState(false);
  const [isCustomJudge, setIsCustomJudge] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const [activeRun, setActiveRun] = useState<EvalRunDetail | null>(null);
  const [history, setHistory] = useState<EvalRunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const [bList, hList, fetchedModels] = await Promise.all([
        listBenchmarks(),
        listEvalHistory(),
        availableModels && availableModels.length > 0 ? Promise.resolve(availableModels) : getAvailableModels(),
      ]);
      setBenchmarks(bList);
      if (bList.length > 0 && !selectedBenchmarkId) {
        setSelectedBenchmarkId(bList[0].id);
      }
      setHistory(hList);
      if (hList.length > 0) {
        const detail = await getEvalDetail(hList[0].id);
        setActiveRun(detail);
      }

      // Filter out embedding models
      const generativeModels = (fetchedModels || []).filter(
        (m) => !m.includes("embed") && !m.includes("bge-m3") && !m.includes("nomic")
      );
      if (generativeModels.length > 0) {
        setModelList(generativeModels);
        setTargetModel((prev) =>
          generativeModels.includes(prev) ? prev : generativeModels.find((m) => m.includes("1.5b")) || generativeModels[0]
        );
        setJudgeModel((prev) =>
          generativeModels.includes(prev)
            ? prev
            : generativeModels.find((m) => m.includes("qwen3") || m.includes("8b")) || generativeModels[generativeModels.length - 1]
        );
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRunEvaluation = async () => {
    if (!selectedBenchmarkId || isRunning) return;
    if (!isAuthenticated) {
      setAuthModalMode("login");
      setShowAuthModal(true);
      return;
    }
    setIsRunning(true);
    setError(null);
    try {
      const res = await runBenchmark(selectedBenchmarkId, targetModel, judgeModel);
      setActiveRun(res);
      listEvalHistory().then(setHistory).catch(console.error);
    } catch (e: any) {
      setError(e.message || "Failed to execute evaluation suite");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSelectHistoryRun = async (runId: string) => {
    try {
      const detail = await getEvalDetail(runId);
      setActiveRun(detail);
    } catch (e: any) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-5xl h-[85vh] bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                LLM-as-a-Judge Evaluation Studio
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automated multi-metric benchmarking (Faithfulness, Relevance, Hallucination)
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
          {/* Left Panel: Run Configuration */}
          <div className="w-80 border-r border-[var(--border)] p-4 flex flex-col gap-4 bg-[var(--card)]/30">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                Select Benchmark Dataset
              </label>
              <select
                value={selectedBenchmarkId}
                onChange={(e) => setSelectedBenchmarkId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs bg-[var(--card)]"
              >
                {benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.test_case_count} cases)
                  </option>
                ))}
              </select>
            </div>

            {/* Target Model Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Target Model (Candidate)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomTarget(!isCustomTarget)}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  title={isCustomTarget ? "Select from installed models" : "Type custom model name"}
                >
                  {isCustomTarget ? <List className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  <span>{isCustomTarget ? "List" : "Custom"}</span>
                </button>
              </div>

              {isCustomTarget ? (
                <input
                  type="text"
                  value={targetModel}
                  onChange={(e) => setTargetModel(e.target.value)}
                  placeholder="e.g. qwen2.5:1.5b"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs font-mono bg-[var(--card)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <select
                  value={targetModel}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomTarget(true);
                    } else {
                      setTargetModel(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs font-mono bg-[var(--card)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {modelList.length > 0 ? (
                    modelList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="qwen2.5:1.5b">qwen2.5:1.5b</option>
                      <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                      <option value="deepseek-r1:8b">deepseek-r1:8b</option>
                      <option value="qwen3:8b">qwen3:8b</option>
                    </>
                  )}
                  <option value="__custom__">✏️ Custom Model Name...</option>
                </select>
              )}
            </div>

            {/* Judge Model Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Judge Model (Evaluator)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomJudge(!isCustomJudge)}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  title={isCustomJudge ? "Select from installed models" : "Type custom model name"}
                >
                  {isCustomJudge ? <List className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  <span>{isCustomJudge ? "List" : "Custom"}</span>
                </button>
              </div>

              {isCustomJudge ? (
                <input
                  type="text"
                  value={judgeModel}
                  onChange={(e) => setJudgeModel(e.target.value)}
                  placeholder="e.g. qwen3:8b"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs font-mono bg-[var(--card)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <select
                  value={judgeModel}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomJudge(true);
                    } else {
                      setJudgeModel(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-xs font-mono bg-[var(--card)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {modelList.length > 0 ? (
                    modelList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="qwen3:8b">qwen3:8b (Evaluator)</option>
                      <option value="deepseek-r1:8b">deepseek-r1:8b (Evaluator)</option>
                      <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                      <option value="qwen2.5:1.5b">qwen2.5:1.5b</option>
                    </>
                  )}
                  <option value="__custom__">✏️ Custom Model Name...</option>
                </select>
              )}
            </div>

            <button
              onClick={handleRunEvaluation}
              disabled={isRunning}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              {isRunning ? (
                <Clock className="w-4 h-4 animate-spin" />
              ) : !isAuthenticated ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>
                {isRunning
                  ? "Evaluating Benchmark..."
                  : !isAuthenticated
                  ? "Sign In to Run Benchmark"
                  : "Execute Evaluation"}
              </span>
            </button>

            {/* Past Runs History */}
            <div className="flex-1 mt-2 border-t border-[var(--border)] pt-3">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">
                Previous Scorecards
              </span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => handleSelectHistoryRun(h.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                      activeRun?.id === h.id
                        ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                        : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {h.dataset_name}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        {((h.summary_scores?.pass_rate || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {h.model_name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Scorecard & Test Cases Drill-down */}
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeRun ? (
              <div className="space-y-6">
                {/* Scorecard Metrics Bar */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[11px] font-medium text-gray-500">Pass Rate</span>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {((activeRun.summary_scores?.pass_rate || 0) * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {activeRun.passed_cases} / {activeRun.total_test_cases} test cases
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[11px] font-medium text-gray-500">Faithfulness</span>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                      {((activeRun.summary_scores?.avg_faithfulness || 0) * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-gray-400">Grounded in context</span>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[11px] font-medium text-gray-500">Answer Relevance</span>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {((activeRun.summary_scores?.avg_relevance || 0) * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-gray-400">Directly addresses prompt</span>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-[11px] font-medium text-gray-500">Hallucination Index</span>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {((activeRun.summary_scores?.avg_hallucination || 0) * 100).toFixed(1)}%
                    </div>
                    <span className="text-[10px] text-gray-400">Lower is better</span>
                  </div>
                </div>

                {/* Test Cases Results */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Test Case Verdicts & Judge Reasoning
                  </h3>

                  <div className="space-y-3">
                    {activeRun.detailed_results?.map((item) => (
                      <div
                        key={item.test_case_id}
                        className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">
                            {item.prompt}
                          </span>
                          <span
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              item.verdict?.passed
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                            }`}
                          >
                            {item.verdict?.passed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Pass
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3" /> Fail
                              </>
                            )}
                          </span>
                        </div>

                        <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">
                          Judge Verdict: {item.verdict?.reasoning || "Scored"}
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-3 text-xs font-mono">
                          <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 overflow-auto max-h-36">
                            <span className="font-bold text-[10px] text-gray-400 block mb-1">
                              Candidate Response:
                            </span>
                            <pre className="whitespace-pre-wrap">{item.candidate_response}</pre>
                          </div>
                          <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 overflow-auto max-h-36">
                            <span className="font-bold text-[10px] text-gray-400 block mb-1">
                              Ground Truth:
                            </span>
                            <pre className="whitespace-pre-wrap">{item.ground_truth}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs">
                <BarChart className="w-12 h-12 mb-2 opacity-20" />
                <p>Run a benchmark evaluation to generate your model scorecard</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
