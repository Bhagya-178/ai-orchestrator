"use client";

import { ReactNode } from "react";
import TopBar from "./TopBar";
import ConversationOverlay from "./ConversationOverlay";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full bg-[var(--background)] overflow-hidden">
      {/* Persistent left sidebar */}
      <ConversationOverlay />

      {/* Main content column: slim header + chat area */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <TopBar />
        <main className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
