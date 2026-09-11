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
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // ── Not authenticated: small icon button in top-right ──
  if (!isAuthenticated || !user) {
    return (
      <button
        onClick={() => {
          setAuthModalMode("login");
          setShowAuthModal(true);
        }}
        className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        title="Sign in"
        aria-label="Sign in"
      >
        <UserIcon className="w-4 h-4" />
      </button>
    );
  }

  // ── Authenticated: avatar with dropdown ──
  const initial = user.full_name
    ? user.full_name[0].toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center shadow-sm hover:ring-2 hover:ring-blue-400/40 transition-all"
        title={user.email}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-lg)] p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-[var(--border)] mb-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--foreground)] truncate max-w-[140px]">
                {user.full_name || "User"}
              </span>
              {user.role === "admin" && (
                <span className="flex items-center gap-1 text-[10px] font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded-md">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--muted)] truncate block mt-0.5">
              {user.email}
            </span>
          </div>

          {/* Workspace hint */}
          <div className="py-1">
            <div className="px-3 py-1 text-[11px] text-[var(--muted)] flex items-center gap-2">
              <UserIcon className="w-3.5 h-3.5" />
              <span>Personal Workspace</span>
            </div>
          </div>

          {/* Sign out */}
          <div className="border-t border-[var(--border)] pt-1 mt-1">
            <button
              onClick={() => { logout(); setOpen(false); }}
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
