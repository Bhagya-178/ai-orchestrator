"use client";

import { ReactNode } from "react";
import TopBar from "./TopBar";
import ConversationOverlay from "./ConversationOverlay";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh] w-full bg-[var(--background)] relative text-[var(--foreground)] font-sans antialiased">
      <TopBar />
      <ConversationOverlay />
      
      <main className="flex-1 flex flex-col relative w-full mx-auto min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
