"use client";

import { useState, useEffect } from "react";
import { X, Moon, Sun, Monitor, Trash2, FileText, Loader2, Activity } from "lucide-react";
import { useTheme } from "@/app/lib/context/ThemeContext";
import { listDocuments, deleteDocument } from "@/app/lib/api/documents";
import { getConversationMetrics } from "@/app/lib/api/conversations";
import { UploadedDocument, ChatMetrics } from "@/app/lib/types";
import { useChat } from "@/app/lib/context/ChatContext";

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"appearance" | "files" | "metrics">("appearance");
  const { theme, setTheme } = useTheme();
  
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [metrics, setMetrics] = useState<ChatMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const { currentConversationId } = useChat();

  const loadDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await listDocuments(currentConversationId);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const loadMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await getConversationMetrics(currentConversationId);
      setMetrics(res.metrics);
    } catch (err) {
      console.error("Failed to load metrics", err);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "files") {
        loadDocs();
      } else if (activeTab === "metrics") {
        loadMetrics();
      }
    }
  }, [isOpen, activeTab, currentConversationId]);

  const handleDeleteFile = async (docId: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteDocument(docId);
        setDocuments(docs => docs.filter(d => d.id !== docId));
      } catch (err) {
        alert("Failed to delete document.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[600px] bg-[var(--background)] border border-[var(--border)] shadow-[var(--shadow)] rounded-xl overflow-hidden flex flex-col md:flex-row h-[70vh] max-h-[500px]">
        
        {/* Sidebar */}
        <div className="w-full md:w-[200px] border-b md:border-b-0 md:border-r border-[var(--border)] p-3 md:p-4 flex flex-row md:flex-col overflow-x-auto gap-1 bg-black/5 dark:bg-white/5 shrink-0">
          <div className="hidden md:block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Settings</div>
          <button 
            onClick={() => setActiveTab("appearance")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-black/10 dark:bg-white/10 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
          >
            Appearance
          </button>
          <button 
            onClick={() => setActiveTab("files")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'files' ? 'bg-black/10 dark:bg-white/10 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
          >
            Manage Files
          </button>
          <button 
            onClick={() => setActiveTab("metrics")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'metrics' ? 'bg-black/10 dark:bg-white/10 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
          >
            Chat Metrics
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="font-semibold text-lg">
              {activeTab === "appearance" ? "Appearance" : activeTab === "files" ? "Manage Files" : "Chat Metrics"}
            </h2>
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">Theme Preference</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setTheme("light")}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-colors ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <Sun className="w-6 h-6" />
                      <span className="text-sm font-medium">Light</span>
                    </button>
                    <button 
                      onClick={() => setTheme("dark")}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-colors ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <Moon className="w-6 h-6" />
                      <span className="text-sm font-medium">Dark</span>
                    </button>
                    <button 
                      onClick={() => setTheme("system")}
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-colors ${theme === 'system' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5'}`}
                    >
                      <Monitor className="w-6 h-6" />
                      <span className="text-sm font-medium">System</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "files" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Manage documents uploaded to this conversation&apos;s knowledge base.
                </p>
                
                {isLoadingDocs ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-xl">
                    <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No files uploaded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-black/5 dark:bg-white/10 rounded-md">
                            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-sm font-medium truncate" title={doc.filename}>{doc.filename}</span>
                            <span className="text-xs text-gray-500">{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(doc.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "metrics" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  View performance statistics and token usage for the current chat session.
                </p>
                
                {isLoadingMetrics ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : metrics ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 border border-[var(--border)] rounded-xl bg-black/5 dark:bg-white/5">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Requests</div>
                      <div className="text-xl sm:text-2xl font-bold">{metrics.total_requests}</div>
                    </div>
                    <div className="p-3.5 border border-[var(--border)] rounded-xl bg-black/5 dark:bg-white/5">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg Latency (ms)</div>
                      <div className="text-xl sm:text-2xl font-bold">{metrics.average_latency_ms.toFixed(0)}</div>
                    </div>
                    <div className="p-3.5 border border-[var(--border)] rounded-xl bg-black/5 dark:bg-white/5">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tokens / Sec</div>
                      <div className="text-xl sm:text-2xl font-bold">{metrics.average_tokens_per_second.toFixed(1)}</div>
                    </div>
                    <div className="p-3.5 border border-[var(--border)] rounded-xl bg-black/5 dark:bg-white/5">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Tokens</div>
                      <div className="text-xl sm:text-2xl font-bold">{metrics.total_prompt_tokens + metrics.total_completion_tokens}</div>
                      <div className="text-[11px] text-gray-500 mt-1">Prompt: {metrics.total_prompt_tokens} · Compl: {metrics.total_completion_tokens}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 border border-dashed border-[var(--border)] rounded-xl">
                    <Activity className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No metrics available for this chat yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
