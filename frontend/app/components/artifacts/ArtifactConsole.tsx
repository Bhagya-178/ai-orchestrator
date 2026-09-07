"use client";

import { useState } from "react";
import { Trash2, AlertCircle, Info, AlertTriangle, Terminal } from "lucide-react";
import { ConsoleMessage } from "@/app/lib/types";

interface ArtifactConsoleProps {
  logs: ConsoleMessage[];
  onClear: () => void;
}

export default function ArtifactConsole({ logs, onClear }: ArtifactConsoleProps) {
  const [filter, setFilter] = useState<"all" | "error" | "warn" | "log">("all");

  const filteredLogs = logs.filter((l) => {
    if (filter === "all") return true;
    return l.type === filter;
  });

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-200 font-mono text-xs">
      {/* Console Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-gray-300">Sandbox Console</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] text-gray-400">
            {logs.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Level Filter */}
          <div className="flex bg-black/40 rounded-md p-0.5 border border-[#30363d]">
            {(["all", "error", "warn", "log"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2 py-0.5 rounded text-[10px] capitalize transition-colors ${
                  filter === lvl
                    ? "bg-blue-600 text-white font-medium"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={onClear}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded transition-colors"
            title="Clear Console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <p>No console messages recorded</p>
          </div>
        ) : (
          filteredLogs.map((l) => (
            <div
              key={l.id}
              className={`flex items-start gap-2 p-1.5 rounded border ${
                l.type === "error"
                  ? "bg-red-950/40 border-red-900/60 text-red-300"
                  : l.type === "warn"
                  ? "bg-yellow-950/40 border-yellow-900/60 text-yellow-300"
                  : "bg-[#161b22]/70 border-[#30363d]/50 text-gray-300"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {l.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                {l.type === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />}
                {l.type === "log" && <Info className="w-3.5 h-3.5 text-blue-400" />}
                {l.type === "info" && <Info className="w-3.5 h-3.5 text-emerald-400" />}
              </div>

              <div className="flex-1 min-w-0 break-all whitespace-pre-wrap">
                {l.message}
              </div>

              <span className="text-[10px] text-gray-500 shrink-0">
                {l.timestamp}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
