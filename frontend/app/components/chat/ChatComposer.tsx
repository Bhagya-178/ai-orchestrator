"use client";

import { useRef, useState } from "react";
import { Paperclip, ArrowUp, FileText, X, Sparkles, AlertCircle } from "lucide-react";
import { useChat } from "@/app/lib/context/ChatContext";
import { uploadDocument } from "@/app/lib/api/documents";
import DocumentAttachment from "../documents/DocumentAttachment";

export default function ChatComposer() {
  const { 
    sendMessage, 
    isGenerating, 
    activeDocument, 
    setActiveDocument, 
    currentConversationId,
    useDocumentContext,
    setUseDocumentContext,
    intentOverride,
    setIntentOverride,
    effortLevel,
    setEffortLevel
  } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    resizeTextarea();
  };

  const handleSend = () => {
    if (message.trim()) {
      sendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
      
      <div className="relative flex flex-col bg-gray-50 dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-gray-100 dark:focus-within:ring-white/5 focus-within:border-gray-300 dark:focus-within:border-white/20 transition-all">
        
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
                  onChange={(e) => setIntentOverride(e.target.value)}
                  className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 text-[11px] font-medium text-gray-600 dark:text-gray-300 outline-none cursor-pointer py-1 px-2 rounded-lg transition-all"
                  title="Model / Intent Override"
                >
                  <option value="auto" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">Auto Model</option>
                  <option value="general" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">General</option>
                  <option value="coding" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">Coding</option>
                  <option value="reasoning" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">Reasoning</option>
                  <option value="study" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">Study</option>
                </select>
                <select
                  value={effortLevel}
                  onChange={(e) => setEffortLevel(e.target.value)}
                  className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:border-black/15 dark:hover:border-white/20 text-[11px] font-medium text-gray-600 dark:text-gray-300 outline-none cursor-pointer py-1 px-2 rounded-lg transition-all"
                  title="Effort Level"
                >
                  <option value="low" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">Low Effort</option>
                  <option value="medium" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">Medium Effort</option>
                  <option value="high" className="bg-white dark:bg-[#18181b] text-gray-900 dark:text-gray-100">High Effort</option>
                </select>
              </div>
            )}
          </div>
          
          <button
            type="button"
            onClick={handleSend}
            disabled={isGenerating || !message.trim()}
            className="p-1.5 shrink-0 bg-black dark:bg-white text-white dark:text-black rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="text-center mt-2">
        <span className="text-[10px] text-gray-400 font-medium">
          Responses are generated locally and may contain mistakes. Verify important information.
        </span>
      </div>
    </div>
  );
}
