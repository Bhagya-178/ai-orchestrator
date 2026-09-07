"use client";

import { X, Sparkles, Check, ArrowRight, ShieldCheck, Zap, Database, Terminal } from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";

interface GuestLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuestLimitModal({ isOpen, onClose }: GuestLimitModalProps) {
  const { setShowAuthModal, setAuthModalMode } = useAuth();

  if (!isOpen) return null;

  const handleSignIn = () => {
    onClose();
    setAuthModalMode("login");
    setShowAuthModal(true);
  };

  const handleSignUp = () => {
    onClose();
    setAuthModalMode("register");
    setShowAuthModal(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden p-6 text-center animate-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
          <Sparkles className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] font-semibold uppercase tracking-wider mb-2">
          <span>Free Preview Limit Reached</span>
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Unlock Full Platform Access
        </h3>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          You have used your 5 free messages on the Guest Tier. Sign in or create an account to unlock all capabilities with zero restrictions.
        </p>

        {/* Feature Highlights */}
        <div className="space-y-2.5 text-left mb-6 text-xs">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border)]">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="text-gray-700 dark:text-gray-200 font-medium">Unlimited conversations & message history</span>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border)]">
            <div className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-gray-700 dark:text-gray-200 font-medium">High-effort reasoning & code synthesis</span>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border)]">
            <div className="w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="w-3.5 h-3.5" />
            </div>
            <span className="text-gray-700 dark:text-gray-200 font-medium">Multi-tenant team workspaces & RBAC</span>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-[var(--border)]">
            <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span className="text-gray-700 dark:text-gray-200 font-medium">Developer API keys, Webhooks & LLM Evals</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
          >
            <span>Sign In to Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleSignUp}
            className="w-full py-2.5 px-4 rounded-xl border border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer"
          >
            Create Free Account
          </button>
        </div>
      </div>
    </div>
  );
}
