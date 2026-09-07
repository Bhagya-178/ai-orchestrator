"use client";

import { ReactNode } from "react";
import TopBar from "./TopBar";
import ConversationOverlay from "./ConversationOverlay";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-full bg-[var(--background)] relative text-[var(--foreground)] font-sans antialiased overflow-hidden">
      <TopBar />
      <ConversationOverlay />
      
      <main className="flex-1 flex flex-col relative w-full mx-auto min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
