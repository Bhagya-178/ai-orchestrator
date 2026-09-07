"use client";

import React, { useState, useEffect } from "react";
import { X, BarChart3, Coins, Database, Server, Clock, MessageSquare, RefreshCw } from "lucide-react";
import { AnalyticsOverview, ModelAnalytics, SystemTelemetry } from "@/app/lib/types";
import { getAnalyticsOverview, getModelAnalytics, getSystemTelemetry } from "@/app/lib/api/analytics";

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AnalyticsModal({ isOpen, onClose }: AnalyticsModalProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [modelStats, setModelStats] = useState<ModelAnalytics[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [ov, mod, tel] = await Promise.all([
        getAnalyticsOverview(),
        getModelAnalytics(),
        getSystemTelemetry(),
      ]);
      setOverview(ov);
      setModelStats(mod);
      setTelemetry(tel);
    } catch (err) {
      console.error("Failed loading analytics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAll();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Telemetry & Cost Analytics</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">System throughput, token volume forecasting, and host infrastructure telemetry</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Total Tokens</span>
                <Coins className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                {overview?.total_tokens.toLocaleString() ?? "0"}
              </div>
              <div className="text-[10px] text-gray-500">
                In: {overview?.tokens_in.toLocaleString() ?? "0"} | Out: {overview?.tokens_out.toLocaleString() ?? "0"}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Estimated Spend</span>
                <Coins className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ${overview?.estimated_cost_usd.toFixed(4) ?? "0.0000"}
              </div>
              <div className="text-[10px] text-gray-500">Calculated on token volume</div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Total Turns</span>
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                {overview?.total_messages.toLocaleString() ?? "0"}
              </div>
              <div className="text-[10px] text-gray-500">Across all sessions</div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02] space-y-1">
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Average Latency</span>
                <Clock className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white font-mono">
                {overview?.avg_latency_ms ?? 0}ms
              </div>
              <div className="text-[10px] text-gray-500">End-to-end turn duration</div>
            </div>
          </div>

          {/* Model Breakdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Usage by Model Architecture
            </h3>
            <div className="border border-[var(--border)] rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-black/5 dark:bg-white/5 border-b border-[var(--border)] text-gray-500 text-[11px]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium">Requests</th>
                    <th className="px-4 py-2 font-medium">Tokens In / Out</th>
                    <th className="px-4 py-2 font-medium">Total Volume</th>
                    <th className="px-4 py-2 font-medium">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {modelStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        No requests recorded yet.
                      </td>
                    </tr>
                  ) : (
                    modelStats.map((m) => (
                      <tr key={m.model} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white font-mono">{m.model}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">{m.request_count}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500 text-[11px]">
                          {m.tokens_in.toLocaleString()} / {m.tokens_out.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold">{m.total_tokens.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono text-emerald-600 dark:text-emerald-400">
                          ${m.estimated_cost_usd.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Host & Runtime Telemetry */}
          {telemetry && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-blue-500" />
                Live Host & Engine Health
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Host CPU Load</span>
                    <span className="font-mono font-semibold">{telemetry.cpu_percent}%</span>
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all"
                      style={{ width: `${Math.min(telemetry.cpu_percent, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">System Memory</span>
                    <span className="font-mono font-semibold">
                      {telemetry.memory_used_gb} / {telemetry.memory_total_gb} GB ({telemetry.memory_percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-purple-600 h-full transition-all"
                      style={{ width: `${Math.min(telemetry.memory_percent, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-1">
                  <span className="text-gray-500 block">Database Pool</span>
                  <div className="text-[11px] font-mono text-gray-700 dark:text-gray-300">
                    Checked in: {telemetry.db_pool.checkedin} | Out: {telemetry.db_pool.checkedout}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500">
                    Max size: {telemetry.db_pool.size} | Overflow: {telemetry.db_pool.overflow}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
