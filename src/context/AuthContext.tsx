"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { SafeUser } from "@/types";

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  login: (email: string, password: string, role?: string) => Promise<{ success: boolean; user?: SafeUser; message?: string }>;
  loginByToken: (token: string) => Promise<{ success: boolean; user?: SafeUser; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Transparent fetch interceptor so every API call automatically carries session headers
if (typeof window !== "undefined") {
  if (!(window as any).__idea_fetch_intercepted) {
    (window as any).__idea_fetch_intercepted = true;
    const origFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      try {
        const storedId = localStorage.getItem("idea_ipo_user_id");
        if (storedId) {
          if (typeof input === "string" || input instanceof URL) {
            const url = typeof input === "string" ? input : input.href;
            if (url.startsWith("/api") || url.includes("/api/")) {
              init = init ? { ...init } : {};
              const h = new Headers(init.headers || {});
              if (!h.has("x-user-id")) {
                h.set("x-user-id", storedId);
              }
              init.headers = h;
              init.credentials = init.credentials || "same-origin";
            }
          } else if (input instanceof Request) {
            if (input.url.includes("/api/")) {
              input.headers.set("x-user-id", storedId);
            }
          }
        }
      } catch (e) {
        // Fallthrough safely
      }
      return origFetch(input, init);
    };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronously restore user from localStorage on initial render to prevent logged-out flicker on refresh
  const [user, setUser] = useState<SafeUser | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("idea_ipo_user");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("idea_ipo_user_id");
    }
    return true;
  });

  const refreshUser = useCallback(async () => {
    try {
      const storedId = typeof window !== "undefined" ? localStorage.getItem("idea_ipo_user_id") : null;
      const headers: Record<string, string> = {};
      if (storedId) {
        headers["x-user-id"] = storedId;
      }
      const res = await fetch("/api/auth/me", { cache: "no-store", headers, credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (typeof window !== "undefined") {
            localStorage.setItem("idea_ipo_user_id", data.user.id);
            localStorage.setItem("idea_ipo_user", JSON.stringify(data.user));
            document.cookie = `idea_ipo_user_id=${data.user.id}; path=/; max-age=604800; SameSite=Lax`;
          }
        } else if (!storedId) {
          setUser(null);
          if (typeof window !== "undefined") {
            localStorage.removeItem("idea_ipo_user");
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        // Explicitly rejected by server
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("idea_ipo_user_id");
          localStorage.removeItem("idea_ipo_user");
          document.cookie = "idea_ipo_user_id=; path=/; max-age=0";
        }
      }
    } catch (err) {
      console.error("Failed to refresh user", err);
      // Do not wipe local session on temporary network or server hiccups
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    // Periodic heartbeat sync every 15s to keep online presence active
    const interval = setInterval(refreshUser, 15000);
    return () => clearInterval(interval);
  }, [refreshUser]);

  const login = async (email: string, password: string, role?: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password, role }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("idea_ipo_user_id", data.user.id);
          localStorage.setItem("idea_ipo_user", JSON.stringify(data.user));
          document.cookie = `idea_ipo_user_id=${data.user.id}; path=/; max-age=604800; SameSite=Lax`;
        }
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || "Login failed" };
    } catch {
      return { success: false, message: "Network error during login" };
    }
  };

  const loginByToken = async (token: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("idea_ipo_user_id", data.user.id);
          localStorage.setItem("idea_ipo_user", JSON.stringify(data.user));
          document.cookie = `idea_ipo_user_id=${data.user.id}; path=/; max-age=604800; SameSite=Lax`;
        }
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || "Invalid 6-digit token code" };
    } catch {
      return { success: false, message: "Network error during token authentication" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("idea_ipo_user_id");
        localStorage.removeItem("idea_ipo_user");
        document.cookie = "idea_ipo_user_id=; path=/; max-age=0";
      }
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginByToken, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
