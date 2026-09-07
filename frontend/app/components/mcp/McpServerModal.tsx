"use client";

import React, { useState, useEffect } from "react";
import { X, Cpu, Plus, Trash2, RotateCw, Activity, Terminal, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
import { McpServerStatus } from "@/app/lib/types";
import { listMcpServers, addMcpServer, removeMcpServer, reconnectMcpServer } from "@/app/lib/api/mcp";

interface McpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function McpServerModal({ isOpen, onClose }: McpServerModalProps) {
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<"stdio" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");

  const loadServers = async () => {
    setIsLoading(true);
    try {
      const data = await listMcpServers();
      setServers(data);
    } catch (err) {
      console.error("Failed loading MCP servers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadServers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMcpServer({
        name: name.trim(),
        transport,
        command: transport === "stdio" ? command.trim() : undefined,
        args: transport === "stdio" && args.trim() ? args.trim().split(" ") : undefined,
        url: transport === "sse" ? url.trim() : undefined,
      });
      setShowAddForm(false);
      setName("");
      setCommand("");
      setArgs("");
      setUrl("");
      await loadServers();
    } catch (err: any) {
      alert(`Error adding MCP server: ${err.message}`);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect and remove this MCP server?")) return;
    await removeMcpServer(id);
    await loadServers();
  };

  const handleReconnect = async (id: string) => {
    await reconnectMcpServer(id);
    await loadServers();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Model Context Protocol (MCP) Hub</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Connect external tool providers, database connectors, and filesystem bridges</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Configured MCP Servers ({servers.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add MCP Server</span>
            </button>
          </div>

          {/* Add Server Form */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="p-4 rounded-xl border border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02] space-y-3 text-xs">
              <h4 className="font-semibold text-gray-900 dark:text-white">Register External MCP Server</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">Server Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. github-tools, postgres-mcp"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">Transport</label>
                  <select
                    value={transport}
                    onChange={(e: any) => setTransport(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                  >
                    <option value="stdio">Standard I/O (Subprocess)</option>
                    <option value="sse">HTTP / Server-Sent Events</option>
                  </select>
                </div>
              </div>

              {transport === "stdio" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Executable / Command</label>
                    <input
                      type="text"
                      required
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="e.g. npx, python, node"
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-500 block mb-1">Arguments (space-separated)</label>
                    <input
                      type="text"
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder="e.g. -y @modelcontextprotocol/server-filesystem"
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-medium text-gray-500 block mb-1">Server URL</label>
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="http://localhost:3001/mcp"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium"
                >
                  Connect Server
                </button>
              </div>
            </form>
          )}

          {/* Server Cards */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-gray-400 text-xs">Loading MCP connections...</div>
            ) : servers.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-[var(--border)] text-gray-400 space-y-2">
                <Terminal className="w-8 h-8 mx-auto stroke-1 opacity-50" />
                <p className="text-xs">No external MCP servers registered yet.</p>
                <p className="text-[11px] text-gray-500">Connect servers via stdio or HTTP to expose external tools to your models.</p>
              </div>
            ) : (
              servers.map((s) => (
                <div key={s.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{s.name}</span>
                      <span className="text-[10px] text-gray-500 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded uppercase font-mono">
                        {s.transport}
                      </span>
                      {s.connected ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" />
                          Disconnected
                        </span>
                      )}
                      {s.latency_ms !== undefined && s.latency_ms !== null && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {s.latency_ms}ms
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleReconnect(s.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 rounded-lg"
                        title="Reconnect"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemove(s.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                        title="Remove Server"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {s.tools.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Exposed Tools ({s.tools.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {s.tools.map((t) => (
                          <span
                            key={t.name}
                            className="px-2 py-1 rounded-md bg-black/5 dark:bg-white/5 border border-[var(--border)] font-mono text-[11px] text-gray-700 dark:text-gray-300"
                            title={t.description}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
