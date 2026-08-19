"use client";

import { useRef, useEffect } from "react";
import { Paperclip, ArrowUp, X } from "lucide-react";
import { useChat } from "@/app/lib/context/ChatContext";
import { uploadDocument } from "@/app/lib/api/documents";
import DocumentAttachment from "../documents/DocumentAttachment";

export default function ChatComposer() {
  const { sendMessage, isGenerating, activeDocument, setActiveDocument, currentConversationId } = useChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const val = textareaRef.current?.value || "";
      if (val.trim()) {
        sendMessage(val);
        if (textareaRef.current) {
          textareaRef.current.value = "";
          resizeTextarea();
        }
      }
    }
  };

  return (
    <div className="w-full max-w-[800px] mx-auto p-4 pb-6 mt-auto">
      <div className="relative flex flex-col bg-white border border-[var(--border)] shadow-[var(--shadow)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-black/5 focus-within:border-black/20 transition-all">
        
        {activeDocument && (
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
          placeholder={activeDocument ? `Ask a question about ${activeDocument.filename}...` : "Ask anything..."}
          className="w-full max-h-[200px] bg-transparent resize-none outline-none py-3 px-4 text-[0.95rem] placeholder:text-gray-400"
          onChange={resizeTextarea}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
        />
        
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="relative">
            <input 
              type="file" 
              className="hidden" 
              id="file-upload" 
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    // Set optimistic uploading state
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
                    alert("Failed to upload document");
                  }
                }
              }}
            />
            <label 
              htmlFor="file-upload"
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-black/5 rounded-md transition-colors cursor-pointer flex items-center justify-center"
              title="Attach document"
            >
              <Paperclip className="w-4 h-4" />
            </label>
          </div>
          
          <button
            type="button"
            onClick={() => {
              const val = textareaRef.current?.value || "";
              if (val.trim()) {
                sendMessage(val);
                if (textareaRef.current) {
                  textareaRef.current.value = "";
                  resizeTextarea();
                }
              }
            }}
            disabled={isGenerating}
            className="p-1.5 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:bg-gray-300 transition-colors"
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
