"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatINR, formatSharePrice, formatPriceChange, getSubscriptionStatus } from "@/lib/formatters";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Award,
  Crown,
  Medal,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Users,
  Coins,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import type { StartupItem } from "@/types";

interface PodiumConfig {
  rank: number;
  label: string;
  medalIcon: React.ElementType;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  cardBorder: string;
  cardGlow: string;
  glowLine: string;
  accentText: string;
}

const PODIUM_CONFIGS: Record<number, PodiumConfig> = {
  1: {
    rank: 1,
    label: "1ST PLACE • CHAMPION",
    medalIcon: Crown,
    badgeBg: "bg-amber-400/20",
    badgeBorder: "border-amber-400/50",
    badgeText: "text-amber-300",
    cardBorder: "border-amber-400/50 hover:border-amber-400/70",
    cardGlow: "shadow-[0_0_35px_rgba(245,158,11,0.15)]",
    glowLine: "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500",
    accentText: "text-amber-300",
  },
  2: {
    rank: 2,
    label: "2ND PLACE • RUNNER-UP",
    medalIcon: Medal,
    badgeBg: "bg-slate-300/20",
    badgeBorder: "border-slate-300/50",
    badgeText: "text-slate-200",
    cardBorder: "border-slate-300/40 hover:border-slate-300/60",
    cardGlow: "shadow-[0_0_30px_rgba(203,213,225,0.12)]",
    glowLine: "bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400",
    accentText: "text-slate-200",
  },
  3: {
    rank: 3,
    label: "3RD PLACE • FINALIST",
    medalIcon: Award,
    badgeBg: "bg-amber-700/20",
    badgeBorder: "border-amber-700/50",
    badgeText: "text-amber-400",
    cardBorder: "border-amber-700/40 hover:border-amber-700/60",
    cardGlow: "shadow-[0_0_30px_rgba(180,83,9,0.12)]",
    glowLine: "bg-gradient-to-r from-amber-700 via-amber-500 to-amber-700",
    accentText: "text-amber-400",
  },
};

export default function LeaderboardPage() {
  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStartups = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/startups", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStartups(data);
        }
      }
    } catch (err) {
      console.error("Failed to load startups for rankings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStartups();
    const interval = setInterval(fetchStartups, 3000);
    return () => clearInterval(interval);
  }, [fetchStartups]);

  // Rank startups strictly by Total Capital Raised (descending) and take ONLY TOP 3
  const topThree = [...startups]
    .sort((a, b) => (b.totalInvestmentReceived || 0) - (a.totalInvestmentReceived || 0))
    .slice(0, 3);

  return (
    <div className="space-y-6 sm:space-y-10 pb-16 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="text-center space-y-3 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>TOP 3 PODIUM RANKINGS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          Live Venture Leaderboard
        </h1>
        <p className="text-xs sm:text-sm font-mono text-zinc-400 max-w-lg mx-auto">
          Current top 3 startup companies leading the live auditorium competition by total capital raised and market valuation.
        </p>
      </div>

      {/* Top 3 Companies Grid */}
      {loading && topThree.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 pt-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-96 rounded-3xl border border-white/10 bg-white/[0.03] animate-pulse"
            />
          ))}
        </div>
      ) : topThree.length === 0 ? (
        <Card className="glass-panel-premium p-12 text-center text-zinc-400 font-mono text-xs border-white/10">
          No startup companies currently ranked.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 pt-2 items-stretch">
          {topThree.map((startup, idx) => {
            const rank = idx + 1;
            const config = PODIUM_CONFIGS[rank] || PODIUM_CONFIGS[3];
            const MedalIcon = config.medalIcon;

            const sub = getSubscriptionStatus(startup.totalInvestmentReceived, startup.fundingAsk);
            const openP = startup.openPrice || startup.initialPrice || 100;
            const chg = startup.priceChange ?? Number((startup.currentPrice - openP).toFixed(2));
            const pct =
              startup.percentageChange ??
              Number((((startup.currentPrice - openP) / openP) * 100).toFixed(2));
            const stat = formatPriceChange(chg, pct);
            const isPos = chg >= 0;
            const marketCap = (startup.totalShares || 1000000) * startup.currentPrice;

            return (
              <motion.div
                key={startup.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className={`flex flex-col h-full ${rank === 1 ? "md:-translate-y-2" : ""}`}
              >
                <Card
                  className={`relative flex-1 flex flex-col justify-between overflow-hidden rounded-3xl border bg-gradient-to-b from-[#0f172a]/90 via-[#0a0f1c]/90 to-[#060911]/90 backdrop-blur-2xl transition-all duration-300 ${config.cardBorder} ${config.cardGlow}`}
                >
                  {/* Glowing Top Ribbon */}
                  <div className={`absolute top-0 left-0 right-0 h-2 ${config.glowLine} shadow-[0_0_20px_rgba(245,158,11,0.5)]`} />

                  <CardHeader className="p-6 sm:p-7 pb-4">
                    {/* Rank Badge Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-mono text-xs font-black ${config.badgeBg} ${config.badgeBorder} ${config.badgeText}`}
                      >
                        <MedalIcon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                        {startup.industry}
                      </span>
                    </div>

                    {/* Startup Title */}
                    <div className="space-y-1">
                      <CardTitle className="text-2xl sm:text-3xl font-black text-white hover:text-cyan-300 transition-colors">
                        <Link href={`/startup/${startup.slug}`}>{startup.name}</Link>
                      </CardTitle>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {startup.tagLine}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 sm:p-7 pt-0 space-y-4">
                    {/* Main Scorecard: Capital Raised */}
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-1">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                        Capital Raised
                      </span>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-2xl sm:text-3xl font-mono font-black ${config.accentText}`}>
                          {formatINR(startup.totalInvestmentReceived)}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          {sub.label}
                        </span>
                      </div>
                    </div>

                    {/* Secondary Metrics Strip */}
                    <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase">Stock Price</span>
                        <span className="text-sm font-bold text-white">
                          {formatSharePrice(startup.currentPrice)}
                        </span>
                        <span className={`text-[10px] block font-bold ${stat.textClass}`}>
                          {isPos ? "+" : ""}
                          {stat.text}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase">Market Cap</span>
                        <span className="text-sm font-bold text-amber-300 block truncate">
                          {formatINR(marketCap)}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">
                          {startup.investorCount} Backers
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-6 sm:p-7 pt-0 border-t border-white/[0.08] mt-auto">
                    <Link
                      href={`/startup/${startup.slug}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-zinc-200 hover:border-cyan-500/50 hover:bg-white/10 hover:text-white font-mono text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      Trade Stock <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400" />
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
