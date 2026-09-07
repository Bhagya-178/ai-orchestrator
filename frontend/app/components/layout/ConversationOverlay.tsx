"use client";

import { useEffect, useRef } from "react";
import { Plus, X, Sparkles, ShieldCheck } from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import { useChat } from "@/app/lib/context/ChatContext";
import { useAuth } from "@/app/lib/context/AuthContext";
import ConversationList from "../conversations/ConversationList";

export default function ConversationOverlay() {
  const { isSidebarOpen, closeSidebar } = useNavigation();
  const { clearChat } = useChat();
  const { 
    user, 
    isAuthenticated, 
    guestMessageCount, 
    guestMessageLimit, 
    setShowAuthModal, 
    setAuthModalMode 
  } = useAuth();
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
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors w-full mr-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button 
            onClick={closeSidebar}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
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

        {/* Sidebar Footer: Tier Status */}
        {!isAuthenticated ? (
          <div className="p-3 border-t border-[var(--border)]/70 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-900 dark:text-white">Guest Tier</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Free Preview
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden mb-2">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (guestMessageCount / guestMessageLimit) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>{guestMessageCount} / {guestMessageLimit} messages used</span>
              <button
                onClick={() => {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                  closeSidebar();
                }}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Sign In &rarr;
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-[var(--border)]/70 flex items-center justify-between text-xs bg-black/[0.01] dark:bg-white/[0.01]">
            <div className="flex items-center gap-2 truncate">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-semibold flex items-center justify-center text-[10px] shrink-0">
                {user?.full_name ? user.full_name[0].toUpperCase() : user?.email[0].toUpperCase()}
              </div>
              <span className="truncate font-medium text-gray-800 dark:text-gray-200">{user?.email}</span>
            </div>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              {user?.role === "admin" ? "Admin" : "Member"}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
