"use client";

import { useState, useRef, useEffect } from "react";
import { X, Lock, Mail, User as UserIcon, AlertCircle, Sparkles, KeyRound, ArrowLeft, RotateCcw, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/app/lib/context/AuthContext";

export default function AuthModal() {
  const {
    showAuthModal,
    setShowAuthModal,
    authModalMode,
    setAuthModalMode,
    login,
    register,
    verifyOtp,
    resendOtp,
    pendingEmail,
    setPendingEmail,
    devOtp,
    setDevOtp,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP 6-digit inputs
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  const [countdown, setCountdown] = useState<number>(60);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (authModalMode === "verify_otp" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [authModalMode, countdown]);

  // When switching to verify_otp, focus the first OTP digit
  useEffect(() => {
    if (authModalMode === "verify_otp") {
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [authModalMode]);

  if (!showAuthModal) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      if (authModalMode === "login") {
        await login(email, password);
        setEmail("");
        setPassword("");
      } else if (authModalMode === "register") {
        const res = await register(email, password, fullName);
        setSuccessNotice(res.message || "Verification code sent to your email.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Keep only numbers
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      const newDigits = [...otpDigits];
      newDigits[index] = "";
      setOtpDigits(newDigits);
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || "";
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setError(null);
    setSuccessNotice(null);
    setLoading(true);

    try {
      await verifyOtp(code);
      setEmail("");
      setPassword("");
      setFullName("");
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await resendOtp();
      setCountdown(res.cooldown_seconds || 60);
      setSuccessNotice("A fresh verification code has been dispatched.");
    } catch (err: any) {
      setError(err.message || "Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFillDevOtp = () => {
    if (!devOtp || devOtp.length !== 6) return;
    const digits = devOtp.split("");
    setOtpDigits(digits);
    inputRefs.current[5]?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 mb-3">
            {authModalMode === "verify_otp" ? (
              <KeyRound className="w-6 h-6" />
            ) : (
              <Sparkles className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {authModalMode === "login"
              ? "Welcome back"
              : authModalMode === "register"
              ? "Create your account"
              : "Verify your email"}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {authModalMode === "login"
              ? "Sign in to access your saved conversations & files"
              : authModalMode === "register"
              ? "Register with email verification to isolate sessions"
              : `Enter the 6-digit confirmation code sent to ${pendingEmail || "your email"}`}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successNotice && !error && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* STEP 2: VERIFY OTP SCREEN */}
        {authModalMode === "verify_otp" ? (
          <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
            {/* Dev Mode Helper Pill (if SMTP not configured) */}
            {devOtp && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-semibold shrink-0">Dev OTP:</span>
                  <code className="bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono font-bold tracking-wider text-amber-900 dark:text-amber-200">
                    {devOtp}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleAutoFillDevOtp}
                  className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-medium transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            )}

            {/* 6 Digit Input Boxes */}
            <div className="flex justify-between items-center gap-2 sm:gap-2.5 my-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={handleOtpPaste}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center font-mono font-bold text-xl sm:text-2xl rounded-xl bg-black/5 dark:bg-white/5 border border-black/15 dark:border-white/15 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-white outline-none transition-all"
                  autoComplete="off"
                />
              ))}
            </div>

            {/* Submit Verification Button */}
            <button
              type="submit"
              disabled={loading || otpDigits.join("").length !== 6}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? "Verifying..." : "Verify & Activate Account"}
            </button>

            {/* Resend and Change Email controls */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode("register");
                  setError(null);
                  setSuccessNotice(null);
                }}
                className="inline-flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change email
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                className={`inline-flex items-center gap-1.5 font-medium transition-colors ${
                  countdown > 0
                    ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
              </button>
            </div>
          </form>
        ) : (
          /* STEP 1: LOGIN / REGISTER SCREEN */
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authModalMode === "register" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={authModalMode === "login" ? "text" : "email"}
                  required
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 mt-2 shadow-sm"
            >
              {loading
                ? "Processing..."
                : authModalMode === "login"
                ? "Sign In"
                : "Create Account & Send Code"}
            </button>
          </form>
        )}

        {/* Switch mode links */}
        {authModalMode !== "verify_otp" && (
          <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-[var(--border)] pt-4">
            {authModalMode === "login" ? (
              <span>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("register");
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode("login");
                    setError(null);
                    setSuccessNotice(null);
                  }}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Log in
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
