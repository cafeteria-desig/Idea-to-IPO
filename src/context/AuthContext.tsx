"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { SafeUser } from "@/types";

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
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
        const storedSessionToken = localStorage.getItem("idea_ipo_session_token");
        const storedSessionId = localStorage.getItem("idea_ipo_session_id");

        if (storedId || storedSessionToken) {
          if (typeof input === "string" || input instanceof URL) {
            const url = typeof input === "string" ? input : input.href;
            if (url.startsWith("/api") || url.includes("/api/")) {
              init = init ? { ...init } : {};
              const h = new Headers(init.headers || {});
              if (storedId && !h.has("x-user-id")) h.set("x-user-id", storedId);
              if (storedSessionToken && !h.has("x-session-token")) h.set("x-session-token", storedSessionToken);
              if (storedSessionId && !h.has("x-session-id")) h.set("x-session-id", storedSessionId);
              init.headers = h;
              init.credentials = init.credentials || "same-origin";
            }
          } else if (input instanceof Request) {
            if (input.url.includes("/api/")) {
              if (storedId) input.headers.set("x-user-id", storedId);
              if (storedSessionToken) input.headers.set("x-session-token", storedSessionToken);
              if (storedSessionId) input.headers.set("x-session-id", storedSessionId);
            }
          }
        }
      } catch {
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

  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("idea_ipo_user_id");
    }
    return true;
  });

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const storedId = typeof window !== "undefined" ? localStorage.getItem("idea_ipo_user_id") : null;
      const storedSessionToken = typeof window !== "undefined" ? localStorage.getItem("idea_ipo_session_token") : null;
      const storedSessionId = typeof window !== "undefined" ? localStorage.getItem("idea_ipo_session_id") : null;

      const headers: Record<string, string> = {};
      if (storedId) headers["x-user-id"] = storedId;
      if (storedSessionToken) headers["x-session-token"] = storedSessionToken;
      if (storedSessionId) headers["x-session-id"] = storedSessionId;

      const res = await fetch("/api/auth/me", { cache: "no-store", headers, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.user) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("idea_ipo_user_id", data.user.id);
          localStorage.setItem("idea_ipo_user", JSON.stringify(data.user));
          document.cookie = `idea_ipo_user_id=${data.user.id}; path=/; max-age=604800; SameSite=Lax`;
        }
      } else if (res.status === 401 || data.sessionInvalidated) {
        // Single Login Constraint: Another login occurred with this token!
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("idea_ipo_user_id");
          localStorage.removeItem("idea_ipo_session_token");
          localStorage.removeItem("idea_ipo_session_id");
          localStorage.removeItem("idea_ipo_user");
          document.cookie = "idea_ipo_user_id=; path=/; max-age=0";
          document.cookie = "idea_ipo_session=; path=/; max-age=0";
        }
        setSessionNotice(
          data.message ||
            "🔒 Only 1 active login is allowed on this token number. You were signed out because this token was used on another device or tab."
        );
      } else if (!storedId && !data.user) {
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("idea_ipo_user");
        }
      }
    } catch (err) {
      console.error("Failed to refresh user", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    // Periodic heartbeat sync every 15s to enforce single-login constraint & online presence
    const interval = setInterval(refreshUser, 15000);
    return () => clearInterval(interval);
  }, [refreshUser]);

  const login = async (email: string, password: string, role?: string) => {
    try {
      setSessionNotice(null);
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
          if (data.sessionId) localStorage.setItem("idea_ipo_session_id", data.sessionId);
          if (data.sessionToken) localStorage.setItem("idea_ipo_session_token", data.sessionToken);
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
      setSessionNotice(null);
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
          if (data.sessionId) localStorage.setItem("idea_ipo_session_id", data.sessionId);
          if (data.sessionToken) localStorage.setItem("idea_ipo_session_token", data.sessionToken);
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
        localStorage.removeItem("idea_ipo_session_token");
        localStorage.removeItem("idea_ipo_session_id");
        localStorage.removeItem("idea_ipo_user");
        document.cookie = "idea_ipo_user_id=; path=/; max-age=0";
        document.cookie = "idea_ipo_session=; path=/; max-age=0";
      }
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        sessionNotice,
        clearSessionNotice,
        login,
        loginByToken,
        logout,
        refreshUser,
      }}
    >
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
