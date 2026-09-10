"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User, OtpRegisterResponse } from "../types";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  verifyOtpUser,
  resendOtp,
  updateCurrentUser,
} from "../api/auth";

const GUEST_MESSAGE_LIMIT = 5;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<OtpRegisterResponse>;
  verifyOtp: (otp: string) => Promise<void>;
  resendOtp: () => Promise<OtpRegisterResponse>;
  logout: () => Promise<void>;
  updateProfile: (data: { full_name?: string; custom_instructions?: string; password?: string }) => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (val: boolean) => void;
  authModalMode: "login" | "register" | "verify_otp";
  setAuthModalMode: (val: "login" | "register" | "verify_otp") => void;
  pendingEmail: string;
  setPendingEmail: (val: string) => void;
  devOtp: string | null;
  setDevOtp: (val: string | null) => void;
  guestMessageCount: number;
  guestMessageLimit: number;
  isGuestLimitReached: boolean;
  incrementGuestMessageCount: () => void;
  resetGuestMessageCount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "verify_otp">("login");
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [guestMessageCount, setGuestMessageCount] = useState<number>(0);

  // Initialize guest counter from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("ai_orchestrator_guest_msg_count");
        if (stored) {
          setGuestMessageCount(parseInt(stored, 10) || 0);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const incrementGuestMessageCount = useCallback(() => {
    setGuestMessageCount((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem("ai_orchestrator_guest_msg_count", next.toString());
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const resetGuestMessageCount = useCallback(() => {
    setGuestMessageCount(0);
    try {
      localStorage.removeItem("ai_orchestrator_guest_msg_count");
    } catch {
      // ignore
    }
  }, []);

  // Re-hydrate session from localStorage on initial load
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window === "undefined") return;
      const token = localStorage.getItem("ai_orchestrator_access_token");
      const savedUser = localStorage.getItem("ai_orchestrator_user");

      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          // ignore
        }
      }

      if (token) {
        try {
          const freshUser = await getCurrentUser();
          setUser(freshUser);
        } catch (err) {
          console.warn("Could not fetch current user profile on startup:", err);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginUser(email, password);
    setUser(res.user);
    setShowAuthModal(false);
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string = "") => {
    const res = await registerUser(email, password, fullName);
    setPendingEmail(email);
    setDevOtp(res.dev_otp || null);
    setAuthModalMode("verify_otp");
    return res;
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    if (!pendingEmail) {
      throw new Error("No pending registration email found. Please register again.");
    }
    const res = await verifyOtpUser(pendingEmail, otp);
    setUser(res.user);
    setShowAuthModal(false);
    setPendingEmail("");
    setDevOtp(null);
    setAuthModalMode("login");
  }, [pendingEmail]);

  const resendOtpAction = useCallback(async () => {
    if (!pendingEmail) {
      throw new Error("No pending registration email found. Please register again.");
    }
    const res = await resendOtp(pendingEmail);
    if (res.dev_otp) {
      setDevOtp(res.dev_otp);
    }
    return res;
  }, [pendingEmail]);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { full_name?: string; custom_instructions?: string; password?: string }) => {
    const updated = await updateCurrentUser(data);
    setUser(updated);
  }, []);

  const isAuthenticated = !!user;
  const isGuestLimitReached = !isAuthenticated && guestMessageCount >= GUEST_MESSAGE_LIMIT;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        verifyOtp,
        resendOtp: resendOtpAction,
        logout,
        updateProfile,
        showAuthModal,
        setShowAuthModal,
        authModalMode,
        setAuthModalMode,
        pendingEmail,
        setPendingEmail,
        devOtp,
        setDevOtp,
        guestMessageCount,
        guestMessageLimit: GUEST_MESSAGE_LIMIT,
        isGuestLimitReached,
        incrementGuestMessageCount,
        resetGuestMessageCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
