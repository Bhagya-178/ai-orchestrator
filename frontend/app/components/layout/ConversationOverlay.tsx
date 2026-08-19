"use client";

import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import { useChat } from "@/app/lib/context/ChatContext";
import ConversationList from "../conversations/ConversationList";

export default function ConversationOverlay() {
  const { isSidebarOpen, closeSidebar } = useNavigation();
  const { clearChat } = useChat();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        closeSidebar();
      }
    };

    if (isSidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSidebarOpen, closeSidebar]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [closeSidebar]);

  return (
    <>
      {/* Backdrop for mobile (optional, but helps isolation) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 transition-opacity sm:hidden" onClick={closeSidebar} />
      )}
      
      {/* Sidebar Panel */}
      <div
        ref={overlayRef}
        className={`fixed top-4 left-4 z-50 flex flex-col bg-[var(--card)] backdrop-blur-xl border border-[var(--border)] shadow-[var(--shadow)] rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden w-[calc(100vw-32px)] sm:w-[320px]`}
        style={{ 
          maxHeight: 'calc(100dvh - 32px)',
          opacity: isSidebarOpen ? 1 : 0,
          transform: isSidebarOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.98)',
          pointerEvents: isSidebarOpen ? 'auto' : 'none'
        }}
      >
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]/50">
          <button 
            onClick={() => {
              clearChat();
              closeSidebar();
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-black/5 hover:bg-black/10 rounded-lg transition-colors w-full mr-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button 
            onClick={closeSidebar}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Conversations
          </div>
          <ConversationList onSelect={closeSidebar} />
        </div>
      </div>
    </>
  );
}
