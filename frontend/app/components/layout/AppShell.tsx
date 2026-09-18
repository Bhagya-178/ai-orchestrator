"use client";

import { ReactNode } from "react";
import ConversationOverlay from "./ConversationOverlay";
import { PanelLeft } from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";

export default function AppShell({ children }: { children: ReactNode }) {
  const { toggleSidebar, isSidebarOpen } = useNavigation();

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--background)] overflow-hidden relative">
      {/* Left sidebar & modals */}
      <ConversationOverlay />

      {/* Floating mobile sidebar toggle (visible when sidebar is closed) */}
      {!isSidebarOpen && (
        <div className="absolute top-3 left-3 z-30 md:hidden">
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] shadow-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main content column: 100% full-height chat canvas */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full">
        <main className="flex-1 flex flex-col relative min-h-0 h-full overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
