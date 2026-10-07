"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/formatters";
import { getUserDisplayIdentifier, getUserTokenOnly } from "@/lib/tokens";
import {
  Menu,
  Search,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";

interface TopbarProps {
  onToggleSidebar?: () => void;
  onOpenCommandPalette: () => void;
}

export function Topbar({ onToggleSidebar, onOpenCommandPalette }: TopbarProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-16 sm:h-20 w-full items-center justify-between border-b border-white/[0.08] bg-[#060810]/95 px-3.5 sm:px-8 backdrop-blur-2xl transition-all relative">
      {/* Left: Mobile menu toggle + Enlarged Vision Club Logo on side */}
      <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Open Menu"
            className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white lg:hidden transition-all active:scale-95"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}

        {/* Enlarged Vision Club Logo on Side */}
        <Link href="/" prefetch={true} className="flex items-center shrink-0 group" title="Vision Club - Learn | Lead | Inspire">
          <div className="relative h-8 sm:h-11 w-24 sm:w-36 transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/vision-club-logo.png"
              alt="Vision Club"
              fill
              priority
              className="object-contain object-left filter drop-shadow-[0_0_12px_rgba(230,198,135,0.4)]"
            />
          </div>
        </Link>
      </div>

      {/* Center: Enlarged IDEA TO IPO Logo in the Center */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
        <Link href="/" prefetch={true} className="flex items-center group shrink-0" title="IDEA TO IPO">
          <div className="relative h-7 sm:h-10 w-32 sm:w-[220px] transition-transform duration-200 group-hover:scale-105">
            <Image
              src="/idea-to-ipo-header.png"
              alt="IDEA TO IPO"
              fill
              priority
              className="object-contain object-center filter drop-shadow-[0_0_14px_rgba(212,175,55,0.45)]"
            />
          </div>
        </Link>
      </div>

      {/* Right: User Profile & Balance Only (Clean & Uncluttered) */}
      <div className="flex items-center justify-end min-w-[44px]">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:p-1.5 sm:pr-3.5 hover:border-emerald-500/40 hover:bg-white/[0.08] backdrop-blur-md transition-all active:scale-95">
              <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 text-[10px] sm:text-xs font-bold font-mono rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 text-emerald-300 border border-emerald-500/35 shadow-inner">
                {user.role === "ADMIN" ? "AD" : `#${getUserTokenOnly(user).slice(-2)}`}
              </Avatar>
              <div className="text-left">
                <div className="hidden sm:flex text-xs font-bold text-white leading-tight items-center gap-1.5">
                  <span className="truncate max-w-[120px] font-mono">{getUserDisplayIdentifier(user)}</span>
                  <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono uppercase text-emerald-400 font-semibold leading-none">
                    {user.role}
                  </span>
                </div>
                {user.role !== "ADMIN" && user.role !== "STARTUP" && (
                  <div className="text-[11px] font-mono font-bold text-emerald-400 sm:mt-0.5">
                    {formatINR(user.currentBalance)}
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="right" className="w-64 p-3 bg-[#0c111e]/95 border-white/10 backdrop-blur-2xl">
              <div className="px-2 py-2 border-b border-white/10 mb-2">
                <p className="text-[10px] font-mono font-semibold uppercase text-zinc-400 tracking-wider">Authorized Simulation ID</p>
                <p className="text-sm font-bold text-white font-mono truncate mt-0.5">{getUserDisplayIdentifier(user)}</p>
                <p className="text-xs text-zinc-500 font-mono truncate">Role: {user.role} • 6-Digit Passkey</p>
                {user.role !== "ADMIN" && user.role !== "STARTUP" && (
                  <div className="mt-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs font-mono text-emerald-400 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Available:</span>
                      <span className="font-bold">{formatINR(user.currentBalance)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 text-[10px]">
                      <span>Total Deployed:</span>
                      <span className="text-white">{formatINR(user.totalInvested)}</span>
                    </div>
                  </div>
                )}
              </div>
              <DropdownMenuItem onClick={onOpenCommandPalette} className="gap-2.5 py-2">
                <Search className="h-4 w-4 text-cyan-400" /> Switch Role or Search (⌘K)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="gap-2.5 py-2 text-rose-400 hover:text-rose-300">
                <LogOut className="h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/"
            prefetch={true}
            className="shimmer-sweep flex items-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-black hover:from-emerald-400 hover:to-teal-300 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5 fill-black" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
