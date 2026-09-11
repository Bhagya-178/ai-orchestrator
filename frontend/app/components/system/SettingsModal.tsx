"use client";

import { useState, useEffect } from "react";
import { X, Moon, Sun, Monitor, Trash2, FileText, Loader2, Cpu, Check, Sparkles } from "lucide-react";
import { useTheme } from "@/app/lib/context/ThemeContext";
import { listDocuments, deleteDocument } from "@/app/lib/api/documents";
import { UploadedDocument } from "@/app/lib/types";
import { useChat } from "@/app/lib/context/ChatContext";
import { getModelDetails, ModelDetail } from "@/app/lib/api/health";

export default function SettingsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"appearance" | "models" | "files">("appearance");
  const { theme, setTheme } = useTheme();
  
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [modelDetails, setModelDetails] = useState<ModelDetail[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const { currentConversationId, intentOverride, setIntentOverride, updateSettings } = useChat();

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const details = await getModelDetails();
      setModelDetails(details);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setIsLoadingModels(false);
    }
  };

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

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "models") {
        loadModels();
      } else if (activeTab === "files") {
        loadDocs();
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
            onClick={() => setActiveTab("models")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'models' ? 'bg-black/10 dark:bg-white/10 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
          >
            Local Models
          </button>
          <button 
            onClick={() => setActiveTab("files")}
            className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'files' ? 'bg-black/10 dark:bg-white/10 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
          >
            Manage Files
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="font-semibold text-lg">
              {activeTab === "appearance" ? "Appearance" : activeTab === "models" ? "Local Models" : "Manage Files"}
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

            {activeTab === "models" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Models installed in local Ollama runtime ({modelDetails.length} available).
                  </p>
                  <button
                    onClick={loadModels}
                    disabled={isLoadingModels}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>

                {isLoadingModels ? (
                  <div className="flex items-center justify-center p-8 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-xs">Querying Ollama runtime...</span>
                  </div>
                ) : modelDetails.length === 0 ? (
                  <div className="text-center p-8 text-gray-400 text-xs">
                    No models found. Pull a model via <code>ollama pull qwen3:8b</code>.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {modelDetails.map((m) => {
                      const isCurrentActive = intentOverride === m.name;
                      const sizeMb = m.size ? Math.round(m.size / (1024 * 1024)) : 0;
                      const sizeGb = (sizeMb / 1024).toFixed(1);
                      return (
                        <div
                          key={m.name}
                          className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                            isCurrentActive
                              ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20"
                              : "border-[var(--border)] bg-black/[0.02] dark:bg-white/[0.02]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white truncate">
                                {m.name}
                              </span>
                              {m.parameter_size && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 dark:bg-white/10 font-mono text-gray-500">
                                  {m.parameter_size}
                                </span>
                              )}
                              {isCurrentActive && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                              {m.size ? <span>{sizeMb > 1000 ? `${sizeGb} GB` : `${sizeMb} MB`}</span> : null}
                              {m.quantization_level && <span>· {m.quantization_level}</span>}
                              {m.family && <span>· {m.family}</span>}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setIntentOverride(m.name);
                              updateSettings(m.name, undefined);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                              isCurrentActive
                                ? "bg-blue-600 text-white"
                                : "hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 border border-[var(--border)]"
                            }`}
                          >
                            {isCurrentActive ? "Active" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
          </div>
        </div>
      </div>
    </div>
  );
}
