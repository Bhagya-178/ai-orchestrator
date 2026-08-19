"use client";

import { Menu } from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import BackendStatus from "../system/BackendStatus";

export default function TopBar() {
  const { openSidebar } = useNavigation();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button 
          onClick={openSidebar}
          className="p-1.5 hover:bg-black/5 rounded-md transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <span className="font-medium tracking-tight text-gray-800">AI Orchestrator</span>
      </div>
      <div>
        <BackendStatus />
      </div>
    </header>
  );
}
