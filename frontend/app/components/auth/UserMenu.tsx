"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon, ShieldCheck } from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";

export default function UserMenu() {
  const { user, isAuthenticated, logout, setShowAuthModal, setAuthModalMode } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Guest Mode
        </span>
        <button
          onClick={() => {
            setAuthModalMode("login");
            setShowAuthModal(true);
          }}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
        >
          Sign In
        </button>
      </div>
    );
  }

  const initial = user.full_name ? user.full_name[0].toUpperCase() : user.email[0].toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-semibold text-xs shadow-sm hover:ring-2 hover:ring-blue-400/50 transition-all"
        title={user.email}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2.5 border-b border-[var(--border)] mb-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">
                {user.full_name || "User"}
              </span>
              {user.role === "admin" && (
                <span className="flex items-center gap-1 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-md">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate block mt-0.5">
              {user.email}
            </span>
          </div>

          <div className="py-1">
            <div className="px-3 py-1 text-[11px] text-gray-400 flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5" />
              <span>Personal Workspace</span>
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-1 mt-1">
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
