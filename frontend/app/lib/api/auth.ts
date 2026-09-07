import { fetchApi } from "./client";
import { User, TokenResponse } from "../types";

export async function loginUser(email: string, password: string): Promise<TokenResponse> {
  const res = await fetchApi("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data: TokenResponse = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("ai_orchestrator_access_token", data.access_token);
    localStorage.setItem("ai_orchestrator_refresh_token", data.refresh_token);
    localStorage.setItem("ai_orchestrator_user", JSON.stringify(data.user));
  }
  return data;
}

export async function registerUser(email: string, password: string, fullName: string = ""): Promise<TokenResponse> {
  const res = await fetchApi("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  const data: TokenResponse = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("ai_orchestrator_access_token", data.access_token);
    localStorage.setItem("ai_orchestrator_refresh_token", data.refresh_token);
    localStorage.setItem("ai_orchestrator_user", JSON.stringify(data.user));
  }
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const res = await fetchApi("/auth/me");
  const user: User = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("ai_orchestrator_user", JSON.stringify(user));
  }
  return user;
}

export async function updateCurrentUser(data: { full_name?: string; custom_instructions?: string; password?: string }): Promise<User> {
  const res = await fetchApi("/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const user: User = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("ai_orchestrator_user", JSON.stringify(user));
  }
  return user;
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    const refreshToken = localStorage.getItem("ai_orchestrator_refresh_token");
    if (refreshToken) {
      try {
        await fetchApi("/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem("ai_orchestrator_access_token");
    localStorage.removeItem("ai_orchestrator_refresh_token");
    localStorage.removeItem("ai_orchestrator_user");
  }
}
