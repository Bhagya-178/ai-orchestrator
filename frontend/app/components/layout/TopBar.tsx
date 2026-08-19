"use client";

import { useState } from "react";
import { Menu, Settings } from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import BackendStatus from "../system/BackendStatus";
import SettingsModal from "../system/SettingsModal";

export default function TopBar() {
  const { openSidebar } = useNavigation();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={openSidebar}
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <span className="font-semibold tracking-tight text-gray-900 dark:text-white">AI Orchestrator</span>
        </div>
        <div className="flex items-center gap-3">
          <BackendStatus />
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </>
  );
}
