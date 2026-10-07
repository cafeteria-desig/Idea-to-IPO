"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Award,
  Wallet,
  ShieldCheck,
  Building2,
  Users,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      routes.forEach((r) => {
        try {
          router.prefetch(r.path);
        } catch {}
      });
    }
  }, [open, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const routes = [
    { name: "Live Pitches & Bidding", path: "/teams", icon: LayoutDashboard, role: "ALL" },
    { name: "Public Market Terminal", path: "/market", icon: TrendingUp, role: "ALL" },
    { name: "Auditorium Leaderboard", path: "/leaderboard", icon: Award, role: "ALL" },
    { name: "Investor Portfolio", path: "/portfolio", icon: Wallet, role: "INVESTOR" },
    { name: "FII Institutional Terminal", path: "/fii", icon: Building2, role: "FII" },
    { name: "Mission Control Room", path: "/admin", icon: ShieldCheck, role: "ADMIN" },
  ];

  const filteredRoutes = routes.filter((item) => {
    if (item.role === "ADMIN" && user?.role !== "ADMIN") return false;
    if (item.role === "FII" && user?.role !== "FII" && user?.role !== "ADMIN") return false;
    if (item.role === "RETAIL" && user?.role !== "RETAIL" && user?.role !== "ADMIN") return false;
    if (item.role === "INVESTOR" && user?.role !== "RETAIL" && user?.role !== "FII") return false;
    return item.name.toLowerCase().includes(query.toLowerCase());
  });

  const handleSelectRoute = (path: string) => {
    onOpenChange(false);
    router.push(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-xl rounded-2xl border border-white/15 bg-[#0b0f19] p-4 shadow-2xl shadow-cyan-500/5">
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <Search className="h-5 w-5 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a screen name or action to navigate..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
            autoFocus
          />
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto pt-3 space-y-4">
          {/* Navigation Section */}
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Navigation
            </div>
            <div className="space-y-1">
              {filteredRoutes.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.path}
                    onClick={() => handleSelectRoute(r.path)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors text-left"
                  >
                    <Icon className="h-4 w-4 text-cyan-400" />
                    <span>{r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-zinc-500 font-mono">
          <span>
            Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">ESC</kbd> to exit
          </span>
          {user && (
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
