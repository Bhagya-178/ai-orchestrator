"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Swords, Zap, Award, RotateCcw, Eye, EyeOff, Square, AlertCircle, CheckCircle2 } from "lucide-react";
import { streamArenaBattle, recordArenaVote, getArenaLeaderboard } from "@/app/lib/api/arena";
import { ArenaMetrics, LeaderboardEntry } from "@/app/lib/types";

interface ArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels: string[];
}

export default function ArenaModal({ isOpen, onClose, availableModels }: ArenaModalProps) {
  const [activeTab, setActiveTab] = useState<"battle" | "leaderboard">("battle");
  const playableModels = (availableModels || []).filter(
    (m) => !m.includes("embed") && !m.includes("bge-m3")
  );

  const [modelA, setModelA] = useState(playableModels[0] || "qwen3:8b");
  const [modelB, setModelB] = useState(playableModels[1] || playableModels[0] || "deepseek-r1:8b");
  const [prompt, setPrompt] = useState("Write a quick explanation of how quantum computing differs from classical computing, then provide an analogy.");
  const [blind, setBlind] = useState(true);

  const [streamA, setStreamA] = useState("");
  const [streamB, setStreamB] = useState("");
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [metricsA, setMetricsA] = useState<ArenaMetrics | null>(null);
  const [metricsB, setMetricsB] = useState<ArenaMetrics | null>(null);
  const [isBattling, setIsBattling] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [votedWinner, setVotedWinner] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (playableModels.length > 0) {
      if (!playableModels.includes(modelA)) setModelA(playableModels[0]);
      if (!playableModels.includes(modelB)) setModelB(playableModels[1] || playableModels[0]);
    }
  }, [availableModels]);

  useEffect(() => {
    if (activeTab === "leaderboard") {
      getArenaLeaderboard().then(setLeaderboard).catch(console.error);
    }
  }, [activeTab]);

  if (!isOpen) return null;

  const handleStopBattle = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsBattling(false);
  };

  const handleReset = () => {
    handleStopBattle();
    setStreamA("");
    setStreamB("");
    setErrorA(null);
    setErrorB(null);
    setGeneralError(null);
    setMetricsA(null);
    setMetricsB(null);
    setRevealed(false);
    setVotedWinner(null);
  };

  const handleStartBattle = async () => {
    if (!prompt.trim() || isBattling) return;

    if (!modelA || !modelB) {
      setGeneralError("Please select both Model A and Model B before starting the battle.");
      return;
    }

    setStreamA("");
    setStreamB("");
    setErrorA(null);
    setErrorB(null);
    setGeneralError(null);
    setMetricsA(null);
    setMetricsB(null);
    setRevealed(false);
    setVotedWinner(null);
    setIsBattling(true);

    abortRef.current = new AbortController();

    try {
      await streamArenaBattle(
        { prompt, model_a: modelA, model_b: modelB, blind, sequential: true },
        (event) => {
          if (event.type === "error") {
            if (event.side === "A") {
              setErrorA(event.error || "Model A encountered an error during generation.");
            } else if (event.side === "B") {
              setErrorB(event.error || "Model B encountered an error during generation.");
            } else {
              setGeneralError(event.error || "Arena battle encountered an error.");
            }
          } else if (event.side === "A") {
            if (event.type === "token" && event.token) {
              setStreamA((prev) => prev + event.token);
            } else if (event.type === "metrics" && event.metrics) {
              setMetricsA(event.metrics);
            }
          } else if (event.side === "B") {
            if (event.type === "token" && event.token) {
              setStreamB((prev) => prev + event.token);
            } else if (event.type === "metrics" && event.metrics) {
              setMetricsB(event.metrics);
            }
          }
        },
        abortRef.current.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Battle stream error:", err);
        setGeneralError(err.message || "Failed to stream battle. Check if Ollama and backend are running.");
      }
    } finally {
      setIsBattling(false);
    }
  };

  const handleVote = async (winner: "A" | "B" | "tie" | "both_bad") => {
    setVotedWinner(winner);
    setRevealed(true);
    try {
      await recordArenaVote({
        prompt,
        model_a: modelA,
        model_b: modelB,
        winner,
      });
      // Refresh leaderboard in background
      getArenaLeaderboard().then(setLeaderboard).catch(console.error);
    } catch (err: any) {
      console.error("Failed to record vote:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Model Arena & Benchmark</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Side-by-side LLM split test with latency telemetry and blind voting</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-medium">
              <button
                onClick={() => setActiveTab("battle")}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeTab === "battle" ? "bg-white dark:bg-black/40 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"
                }`}
              >
                Live Battle
              </button>
              <button
                onClick={() => setActiveTab("leaderboard")}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  activeTab === "leaderboard" ? "bg-white dark:bg-black/40 text-gray-900 dark:text-white shadow-sm" : "text-gray-500"
                }`}
              >
                Leaderboard
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === "battle" ? (
          <div className="flex-1 flex flex-col p-5 overflow-y-auto space-y-4">
            {/* Control Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] text-xs">
              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Model A</label>
                <select
                  value={modelA}
                  onChange={(e) => setModelA(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                >
                  {playableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-500 block mb-1">Model B</label>
                <select
                  value={modelB}
                  onChange={(e) => setModelB(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                >
                  {playableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setBlind(!blind)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-black/5 text-xs font-medium"
                >
                  {blind ? <EyeOff className="w-3.5 h-3.5 text-orange-500" /> : <Eye className="w-3.5 h-3.5 text-blue-500" />}
                  <span>{blind ? "Blind: ON" : "Blind: OFF"}</span>
                </button>

                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>VRAM Safe</span>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset battle"
                  className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {isBattling ? (
                  <button
                    onClick={handleStopBattle}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartBattle}
                    disabled={!prompt.trim() || playableModels.length === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium shadow transition-all disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Start Battle</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error Banner */}
            {generalError && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{generalError}</span>
                </div>
                <button
                  onClick={() => setGeneralError(null)}
                  className="p-1 hover:bg-red-500/20 rounded-md transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Prompt input */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter prompt to battle models..."
                rows={2}
                className="w-full p-3 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none font-sans"
              />
            </div>

            {/* Split Screen Stream Results */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[320px]">
              {/* Column Model A */}
              <div className="flex flex-col border border-[var(--border)] rounded-xl bg-[var(--background)] overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-gray-900 dark:text-white">
                      {blind && !revealed ? "Model A (Hidden)" : modelA}
                    </span>
                    {isBattling && !metricsA && !errorA && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/10 text-blue-600 animate-pulse font-medium">
                        Generating...
                      </span>
                    )}
                  </div>
                  {metricsA && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className="font-mono bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">
                        {metricsA.tokens_per_second} tok/s
                      </span>
                      <span>{metricsA.ttft_ms}ms TTFT</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 p-3.5 text-xs text-gray-800 dark:text-gray-200 overflow-y-auto whitespace-pre-wrap font-sans">
                  {errorA ? (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold mb-0.5">Model A Error</div>
                        <div>{errorA}</div>
                      </div>
                    </div>
                  ) : streamA ? (
                    <span>{streamA}</span>
                  ) : (
                    <span className="text-gray-400 italic">
                      {isBattling ? "⚡ Model A streaming in GPU..." : "Response A will stream here..."}
                    </span>
                  )}
                </div>
              </div>

              {/* Column Model B */}
              <div className="flex flex-col border border-[var(--border)] rounded-xl bg-[var(--background)] overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-gray-900 dark:text-white">
                      {blind && !revealed ? "Model B (Hidden)" : modelB}
                    </span>
                    {isBattling && (metricsA || errorA) && !metricsB && !errorB && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/10 text-purple-600 animate-pulse font-medium">
                        Generating...
                      </span>
                    )}
                  </div>
                  {metricsB && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className="font-mono bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded">
                        {metricsB.tokens_per_second} tok/s
                      </span>
                      <span>{metricsB.ttft_ms}ms TTFT</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 p-3.5 text-xs text-gray-800 dark:text-gray-200 overflow-y-auto whitespace-pre-wrap font-sans">
                  {errorB ? (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold mb-0.5">Model B Error</div>
                        <div>{errorB}</div>
                      </div>
                    </div>
                  ) : streamB ? (
                    <span>{streamB}</span>
                  ) : (
                    <span className="text-gray-400 italic">
                      {isBattling && !metricsA && !errorA
                        ? "⏳ Waiting for Model A to finish & unload from GPU..."
                        : isBattling
                        ? "⚡ Model A unloaded. Model B streaming in GPU..."
                        : "Response B will stream here..."}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Voting Bar */}
            {(streamA || streamB || errorA || errorB) && (
              <div className="pt-2 border-t border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Which response is better?</span>
                  {votedWinner && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 animate-in fade-in">
                      <CheckCircle2 className="w-3 h-3" />
                      Vote recorded: {votedWinner.toUpperCase()} (models revealed!)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleVote("A")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      votedWinner === "A" ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5 border-[var(--border)]"
                    }`}
                  >
                    👈 Model A
                  </button>
                  <button
                    onClick={() => handleVote("B")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      votedWinner === "B" ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5 border-[var(--border)]"
                    }`}
                  >
                    Model B 👉
                  </button>
                  <button
                    onClick={() => handleVote("tie")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      votedWinner === "tie" ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5 border-[var(--border)]"
                    }`}
                  >
                    🤝 Tie
                  </button>
                  <button
                    onClick={() => handleVote("both_bad")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      votedWinner === "both_bad" ? "bg-orange-600 text-white border-orange-600 shadow-sm" : "hover:bg-black/5 dark:hover:bg-white/5 border-[var(--border)]"
                    }`}
                  >
                    👎 Both Bad
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Leaderboard View */
          <div className="flex-1 p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Community Benchmark Leaderboard
              </h3>
            </div>

            <div className="border border-[var(--border)] rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border)] text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Rank</th>
                    <th className="px-4 py-2.5 font-medium">Model</th>
                    <th className="px-4 py-2.5 font-medium">Win Rate</th>
                    <th className="px-4 py-2.5 font-medium">Total Battles</th>
                    <th className="px-4 py-2.5 font-medium">Wins / Losses / Ties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        No battle evaluation votes recorded yet. Start battling to generate leaderboard rankings!
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((entry, idx) => (
                      <tr key={entry.model} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">#{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{entry.model}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {entry.win_rate}%
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500">{entry.battles}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">
                          {entry.wins} / {entry.losses} / {entry.ties}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
