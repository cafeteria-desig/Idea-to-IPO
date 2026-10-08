"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/formatters";
import { getUserDisplayIdentifier, getUserTokenOnly } from "@/lib/tokens";
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  Wallet,
  Building2,
  Users,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Flame,
  Search,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCommandPalette: () => void;
  onNavigate?: () => void;
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  onOpenCommandPalette,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navSections = [
    {
      title: "Market & Exchange",
      items: [
        {
          label: "Live Pitches",
          path: "/teams",
          icon: LayoutDashboard,
          visible: true,
          badge: "LIVE",
        },
        {
          label: "Market Screen",
          path: "/market",
          icon: TrendingUp,
          visible: true,
        },
        {
          label: "Leaderboard",
          path: "/leaderboard",
          icon: Award,
          visible: true,
        },
      ],
    },
    {
      title: "My Terminal",
      items: [
        {
          label: "My Portfolio",
          path: "/portfolio",
          icon: Wallet,
          visible: user?.role === "RETAIL" || user?.role === "FII",
        },
        {
          label: "Orders",
          path: "/orders",
          icon: Clock,
          visible: user?.role === "RETAIL" || user?.role === "FII" || user?.role === "ADMIN",
        },
        {
          label: "FII Terminal",
          path: "/fii",
          icon: Building2,
          visible: user?.role === "FII" || user?.role === "ADMIN",
          badge: "INSTITUTIONAL",
        },
        {
          label: "Founder Portal",
          path: "/teams",
          icon: BarChart3,
          visible: user?.role === "STARTUP" || user?.role === "ADMIN",
          badge: "FOUNDER",
        },
      ],
    },
    {
      title: "Event Governance",
      items: [
        {
          label: "Mission Control",
          path: "/admin",
          icon: ShieldCheck,
          visible: user?.role === "ADMIN",
          badge: "DIRECTOR",
        },
      ],
    },
  ];

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-white/[0.08] bg-[#060810]/95 backdrop-blur-2xl transition-all duration-300 z-30 h-screen sticky top-0",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand Header with Enlarged Vision Club Logo & IDEA TO IPO Just Below */}
      <div className={cn(
        "flex flex-col border-b border-white/[0.08] transition-all bg-gradient-to-b from-black/40 to-transparent",
        collapsed ? "h-20 items-center justify-center p-2" : "p-4"
      )}>
        <div className="flex items-center justify-between w-full">
          <Link
            href="/"
            prefetch={true}
            onClick={() => onNavigate?.()}
            className="flex flex-col items-center mx-auto group text-center overflow-hidden"
            title="Vision Club - Learn | Lead | Inspire"
          >
            {!collapsed ? (
              <>
                {/* Enlarged Vision Club Logo */}
                <div className="relative h-14 w-36 sm:h-16 sm:w-40 overflow-hidden transition-transform duration-300 group-hover:scale-105">
                  <Image
                    src="/vision-club-logo.png"
                    alt="Vision Club"
                    fill
                    className="object-contain filter drop-shadow-[0_0_15px_rgba(230,198,135,0.3)]"
                  />
                </div>
                {/* IDEA TO IPO Just Below (No bg) */}
                <div className="relative h-6 w-[165px] mt-1">
                  <Image
                    src="/idea-to-ipo-header.png"
                    alt="IDEA TO IPO"
                    fill
                    className="object-contain filter drop-shadow-[0_0_10px_rgba(212,175,55,0.35)]"
                  />
                </div>
              </>
            ) : (
              <div className="relative h-9 w-9">
                <Image src="/vision-club-logo.png" alt="Vision Club" fill className="object-contain filter drop-shadow-[0_0_8px_rgba(230,198,135,0.4)]" />
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all hover:scale-105 active:scale-95 shrink-0 ml-1"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex mt-1 h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
            title="Expand sidebar"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3.5 py-6 space-y-7">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => item.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-2">
              {!collapsed && (
                <p className="px-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-1.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;

                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      prefetch={true}
                      onClick={() => onNavigate?.()}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent text-emerald-300 border-l-2 border-l-emerald-400 border-y border-r border-emerald-500/20 shadow-[0_0_20px_rgba(0,229,153,0.12)] font-semibold"
                          : "text-zinc-400 hover:bg-white/[0.06] hover:text-white hover:translate-x-1"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-all duration-200 group-hover:scale-110",
                          isActive ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(0,229,153,0.6)]" : "text-zinc-400 group-hover:text-zinc-200"
                        )}
                      />
                      {!collapsed && (
                        <div className="flex flex-1 items-center justify-between overflow-hidden">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase",
                                item.badge === "LIVE"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse shadow-[0_0_10px_rgba(0,229,153,0.3)]"
                                  : "bg-white/10 text-zinc-300 border border-white/15"
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Area: User Card or Switcher */}
      <div className={cn(
        "border-t border-white/[0.08] bg-gradient-to-t from-black/40 to-transparent flex items-center justify-center",
        collapsed ? "p-2.5" : "p-4"
      )}>
        {user ? (
          <div
            onClick={onOpenCommandPalette}
            className={cn(
              "group flex cursor-pointer items-center rounded-2xl border border-white/10 bg-white/[0.04] transition-all duration-200 hover:border-emerald-500/40 hover:bg-white/[0.08] hover:shadow-[0_0_25px_rgba(0,229,153,0.12)] active:scale-[0.98]",
              collapsed ? "h-11 w-11 p-0 justify-center" : "gap-3.5 p-3 w-full"
            )}
            title="Click to Switch Demo Role"
          >
            <div className={cn(
              "flex shrink-0 items-center justify-center font-bold text-xs text-emerald-300 uppercase shadow-sm",
              collapsed
                ? "h-full w-full rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10"
                : "h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/15 border border-emerald-500/30"
            )}>
              {user.role === "ADMIN" ? "AD" : `#${getUserTokenOnly(user).slice(-2)}`}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-xs font-bold text-white font-mono group-hover:text-emerald-300 transition-colors">
                  {getUserDisplayIdentifier(user)}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mt-0.5">
                  <span className="uppercase text-emerald-400 font-bold tracking-wider">{user.role}</span>
                  {user.role !== "ADMIN" && user.role !== "STARTUP" && (
                    <span className="text-zinc-300">• {formatINR(user.currentBalance)}</span>
                  )}
                </div>
              </div>
            )}
            {!collapsed && <Search className="h-4 w-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />}
          </div>
        ) : (
          <Link
            href="/"
            prefetch={true}
            onClick={() => onNavigate?.()}
            className="shimmer-sweep flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-xs font-bold text-black hover:from-emerald-400 hover:to-teal-300 transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4 fill-black" />
            {!collapsed && <span>Portal Login</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
