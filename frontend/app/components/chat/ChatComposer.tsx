"use client";

import { useRef, useState, useEffect } from "react";
import { Paperclip, ArrowUp, FileText, X, Sparkles, AlertCircle, Square, Layers } from "lucide-react";
import { useChat } from "@/app/lib/context/ChatContext";
import { useAuth } from "@/app/lib/context/AuthContext";
import { uploadDocument } from "@/app/lib/api/documents";
import { getRecentPrompts } from "@/app/lib/api/chat";
import { getAvailableModels } from "@/app/lib/api/health";
import DocumentAttachment from "../documents/DocumentAttachment";
import VoiceInputButton from "../voice/VoiceInputButton";
import GuestLimitModal from "../auth/GuestLimitModal";

export default function ChatComposer() {
  const { 
    messages,
    sendMessage, 
    isGenerating, 
    stopGeneration,
    activeDocument, 
    setActiveDocument, 
    currentConversationId,
    useDocumentContext,
    setUseDocumentContext,
    intentOverride,
    setIntentOverride,
    effortLevel,
    setEffortLevel,
    updateSettings,
  } = useChat();

  const {
    isAuthenticated,
    isGuestLimitReached,
    guestMessageCount,
    guestMessageLimit,
    incrementGuestMessageCount,
    setShowAuthModal,
    setAuthModalMode,
  } = useAuth();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isGuestLimitModalOpen, setIsGuestLimitModalOpen] = useState(false);

  // Message history navigation (like ChatGPT / Claude / Shell)
  const historyIndexRef = useRef<number>(-1);
  const draftRef = useRef<string>("");

  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Fetch available models from backend
  useEffect(() => {
    getAvailableModels()
      .then((models) => {
        const chatModels = models.filter((m) => !m.includes("embed") && !m.includes("bge-m3"));
        setAvailableModels(chatModels);
      })
      .catch(console.error);
  }, []);

  // Pre-seed prompt history from database on load so ArrowUp works immediately
  useEffect(() => {
    getRecentPrompts().then((dbPrompts) => {
      if (dbPrompts && dbPrompts.length > 0) {
        try {
          const raw = localStorage.getItem("ai_orchestrator_prompt_history");
          const existing: string[] = raw ? JSON.parse(raw) : [];
          const merged = Array.from(new Set([...dbPrompts, ...existing]));
          if (merged.length > 50) merged.splice(0, merged.length - 50);
          localStorage.setItem("ai_orchestrator_prompt_history", JSON.stringify(merged));
        } catch {
          // ignore storage errors
        }
      }
    });
  }, []);

  const resizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    historyIndexRef.current = -1;
    resizeTextarea();
  };

  // Persistent prompt history helpers (like ChatGPT / Claude / Shell)
  const getCombinedPromptHistory = () => {
    let saved: string[] = [];
    try {
      const raw = localStorage.getItem("ai_orchestrator_prompt_history");
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = [];
    }

    const sessionPrompts = messages
      .filter((m) => m.role === "user" && m.content.trim())
      .map((m) => m.content.trim());

    // Merge: older saved prompts first, followed by session prompts, no adjacent duplicates
    const combined = Array.from(new Set([...saved, ...sessionPrompts]));
    return combined;
  };

  const persistPrompt = (promptText: string) => {
    try {
      let saved: string[] = [];
      const raw = localStorage.getItem("ai_orchestrator_prompt_history");
      if (raw) saved = JSON.parse(raw);
      const filtered = saved.filter((p) => p !== promptText);
      filtered.push(promptText);
      if (filtered.length > 50) filtered.shift();
      localStorage.setItem("ai_orchestrator_prompt_history", JSON.stringify(filtered));
    } catch {
      // ignore storage errors
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;

    if (!isAuthenticated && isGuestLimitReached) {
      setIsGuestLimitModalOpen(true);
      return;
    }

    persistPrompt(message.trim());
    sendMessage(message);
    if (!isAuthenticated) {
      incrementGuestMessageCount();
    }
    setMessage("");
    historyIndexRef.current = -1;
    draftRef.current = "";
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Up Arrow: retrieve previous user prompt
    if (e.key === "ArrowUp" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const textarea = textareaRef.current;
      const isEmpty = !message.trim();
      const isAtStart = textarea ? textarea.selectionStart === 0 && !message.slice(0, textarea.selectionStart).includes("\n") : true;

      if (isEmpty || isAtStart) {
        const userPrompts = getCombinedPromptHistory();

        if (userPrompts.length > 0) {
          e.preventDefault();
          if (historyIndexRef.current === -1) {
            draftRef.current = message;
            historyIndexRef.current = userPrompts.length - 1;
          } else if (historyIndexRef.current > 0) {
            historyIndexRef.current -= 1;
          }

          const targetPrompt = userPrompts[historyIndexRef.current];
          setMessage(targetPrompt);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = targetPrompt.length;
              resizeTextarea();
            }
          });
        }
      }
      return;
    }

    // Down Arrow: navigate forward in history or restore unsubmitted draft
    if (e.key === "ArrowDown" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (historyIndexRef.current !== -1) {
        const userPrompts = getCombinedPromptHistory();

        e.preventDefault();
        if (historyIndexRef.current < userPrompts.length - 1) {
          historyIndexRef.current += 1;
          const targetPrompt = userPrompts[historyIndexRef.current];
          setMessage(targetPrompt);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = targetPrompt.length;
              resizeTextarea();
            }
          });
        } else {
          // Reached the end: restore saved draft
          historyIndexRef.current = -1;
          setMessage(draftRef.current);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = textareaRef.current.selectionEnd = draftRef.current.length;
              resizeTextarea();
            }
          });
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (file) {
      try {
        setActiveDocument({
          id: "uploading",
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          status: "uploading"
        });
        
        const uploaded = await uploadDocument(file, currentConversationId);
        setActiveDocument(uploaded);
      } catch (error) {
        console.error("Upload failed", error);
        setActiveDocument(null);
        setUploadError("Failed to upload document. Please try again.");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  // Show context pill when: document is uploaded in this session (even if already "sent")
  // The pill persists as long as the conversation has a document
  const showContextPill = !!activeDocument;
  const isRagActive = Boolean(activeDocument && useDocumentContext);

  return (
    <div className="w-full max-w-[800px] mx-auto p-4 pb-6 mt-auto">
      {uploadError && (
        <div className="mb-3 p-3 flex items-center justify-between text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      <div className="relative flex flex-col bg-[#f7f7f5] dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-white/10 focus-within:border-gray-300 dark:focus-within:border-white/20 transition-all shadow-sm">
        
        {/* Document upload preview (only during initial upload) */}
        {activeDocument && activeDocument.status === "uploading" && (
          <div className="px-3 pt-3">
            <DocumentAttachment 
              document={activeDocument} 
              onRemove={() => setActiveDocument(null)} 
            />
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            activeDocument && useDocumentContext 
              ? `Ask about ${activeDocument.filename}...` 
              : "Ask anything..."
          }
          className="w-full max-h-[200px] bg-transparent resize-none outline-none py-3 px-4 text-[0.95rem] text-gray-900 dark:text-white placeholder:text-gray-400"
          disabled={isGenerating}
        />
        
        <div className="flex items-center justify-between px-3 pb-3 gap-2">
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {/* File upload button */}
            <div className="relative shrink-0">
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                id="file-upload" 
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="file-upload"
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                title="Attach document"
              >
                <Paperclip className="w-4 h-4" />
              </label>
            </div>

            <VoiceInputButton 
              onTranscribed={(spokenText) => setMessage((prev) => prev ? `${prev} ${spokenText}` : spokenText)}
              disabled={isGenerating}
            />

            {/* Quick Multi-Agent Swarm Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                if (intentOverride?.startsWith("workflow:")) {
                  setIntentOverride("auto");
                  updateSettings("auto", undefined);
                } else {
                  setIntentOverride("workflow:fullstack");
                  updateSettings("workflow:fullstack", undefined);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                intentOverride?.startsWith("workflow:")
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40"
              }`}
              title={intentOverride?.startsWith("workflow:") ? "Multi-Agent Swarm active (click to disable)" : "Activate Multi-Agent Swarm mode"}
            >
              <Sparkles className="w-3 h-3" />
              <span>⚡ Swarm</span>
            </button>

            {/* Open Studio with current input */}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("open-agent-workflow", { detail: { prompt: message } }));
              }}
              className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer shrink-0"
              title="Open Agent Operations Studio"
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Document Context Pill — unique toggle control */}
            {showContextPill && activeDocument.status !== "uploading" && (
              <button
                onClick={() => setUseDocumentContext(!useDocumentContext)}
                className={`
                  group/pill flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs font-medium
                  transition-all duration-200 border shrink-0
                  ${useDocumentContext 
                    ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300" 
                    : "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 line-through"
                  }
                `}
                title={useDocumentContext ? "Click to disable document context" : "Click to enable document context"}
              >
                <FileText className={`w-3 h-3 ${useDocumentContext ? "text-blue-500 dark:text-blue-400" : "text-gray-400"}`} />
                <span className="max-w-[120px] truncate">{activeDocument.filename}</span>
                {useDocumentContext && (
                  <Sparkles className="w-3 h-3 text-blue-400 dark:text-blue-300" />
                )}
              </button>
            )}

            {/* If a document is attached and context is enabled, show simple indicator and HIDE dropdowns */}
            {isRagActive ? (
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 px-2 py-0.5 rounded-md shrink-0">
                {activeDocument?.status === "uploading" ? "Uploading..." : "RAG active"}
              </span>
            ) : (
              /* Manual Controls — only visible when no document is active */
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={intentOverride}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIntentOverride(val);
                    updateSettings(val, undefined);
                  }}
                  className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 text-[11px] font-medium text-gray-600 dark:text-gray-300 outline-none cursor-pointer py-1 px-2 rounded-lg transition-all max-w-[150px] truncate"
                  title="Select AI Model or Mode"
                >
                  <option value="auto" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100 font-semibold">
                    ✨ Auto Model (Smart)
                  </option>
                  <optgroup label="Multi-Agent DAG Workflows" className="bg-white dark:bg-[#18181b] text-purple-600 dark:text-purple-400 font-semibold">
                    <option value="workflow:fullstack" className="text-gray-900 dark:text-gray-100">⚡ Full-Stack Feature Flow (5 Agents)</option>
                    <option value="workflow:factcheck" className="text-gray-900 dark:text-gray-100">🔍 Deep Fact-Check & Verification (3 Agents)</option>
                    <option value="workflow:vulnerability" className="text-gray-900 dark:text-gray-100">🛡️ Vulnerability & Security Audit (4 Agents)</option>
                  </optgroup>
                  <optgroup label="Intent Routing" className="bg-white dark:bg-[#18181b] text-gray-500 font-medium">
                    <option value="general" className="text-gray-900 dark:text-gray-100">General Chat</option>
                    <option value="coding" className="text-gray-900 dark:text-gray-100">Coding Specialist</option>
                    <option value="reasoning" className="text-gray-900 dark:text-gray-100">Deep Reasoning</option>
                    <option value="study" className="text-gray-900 dark:text-gray-100">Study / Research</option>
                  </optgroup>
                  {availableModels.length > 0 && (
                    <optgroup label="Installed Local Models" className="bg-white dark:bg-[#18181b] text-gray-500 font-medium">
                      {availableModels.map((m) => (
                        <option key={m} value={m} className="text-gray-900 dark:text-gray-100">
                          {m}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <select
                  value={effortLevel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEffortLevel(val);
                    updateSettings(undefined, val);
                  }}
                  className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 text-[11px] font-medium text-gray-600 dark:text-gray-300 outline-none cursor-pointer py-1 px-2 rounded-lg transition-all"
                  title="Effort & Reasoning Depth"
                >
                  <option value="low" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">
                    ⚡ Low (Fast · 2 iters)
                  </option>
                  <option value="medium" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">
                    ⚖️ Medium (5 iters)
                  </option>
                  <option value="high" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">
                    🧠 High (10 iters + Reflection)
                  </option>
                </select>
              </div>
            )}
          </div>
          
          {isGenerating ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="p-1.5 shrink-0 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
              title="Stop generating"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!message.trim()}
              className="send-btn p-1.5 shrink-0 rounded-lg transition-colors cursor-pointer"
              title="Send message"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Guest Preview Quota Indicator */}
      {!isAuthenticated && (
        <div className="flex items-center justify-between text-[11px] px-2 mt-2 text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isGuestLimitReached ? "bg-red-500" : "bg-amber-500"}`} />
            <span>
              {isGuestLimitReached ? (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  Free guest limit reached (5/5)
                </span>
              ) : (
                <span>
                  Guest Tier: <strong>{Math.max(0, guestMessageLimit - guestMessageCount)} of {guestMessageLimit}</strong> free messages left
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAuthModalMode("login");
              setShowAuthModal(true);
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
          >
            Sign in for unlimited &rarr;
          </button>
        </div>
      )}

      <div className="text-center mt-2">
        <span className="text-[10px] text-gray-400 font-medium">
          Responses are generated locally and may contain mistakes. Verify important information.
        </span>
      </div>

      <GuestLimitModal
        isOpen={isGuestLimitModalOpen}
        onClose={() => setIsGuestLimitModalOpen(false)}
      />
    </div>
  );
}
