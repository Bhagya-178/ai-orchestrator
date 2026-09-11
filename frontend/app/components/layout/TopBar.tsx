"use client";

import { PanelLeft } from "lucide-react";
import { useNavigation } from "@/app/lib/context/NavigationContext";
import UserMenu from "../auth/UserMenu";

export default function TopBar() {
  const { toggleSidebar, isSidebarOpen } = useNavigation();

  return (
    <header className="flex items-center justify-between px-3 py-2 shrink-0 z-20">
      {/* Professional sidebar toggle button */}
      <button
        onClick={toggleSidebar}
        className={`w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--border)] transition-all duration-150 shrink-0 cursor-pointer ${
          isSidebarOpen
            ? "bg-black/5 dark:bg-white/10 text-[var(--foreground)]"
            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5"
        }`}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      {/* User profile / login icon */}
      <UserMenu />
    </header>
  );
}
