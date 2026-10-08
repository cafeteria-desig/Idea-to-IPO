"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { formatINR, formatSharePrice, formatPriceChange, getSubscriptionStatus } from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  ArrowUpDown,
  BarChart3,
  Building2,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StartupItem } from "@/types";

type SortOption = "capital" | "price" | "change" | "marketCap" | "volume" | "backers";

export default function LeaderboardPage() {
  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("capital");
  const [viewScope, setViewScope] = useState<"remaining" | "all">("remaining");

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
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchStartups();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStartups]);

  // Global ranking by Total Capital Raised (descending)
  const rankedByCapital = useMemo(() => {
    return [...startups].sort(
      (a, b) => (b.totalInvestmentReceived || 0) - (a.totalInvestmentReceived || 0)
    );
  }, [startups]);

  // First place company
  const firstPlace = rankedByCapital[0] || null;
  // Second place company
  const secondPlace = rankedByCapital[1] || null;

  // Remaining companies (#3 onwards)
  const remainingStartups = useMemo(() => {
    return rankedByCapital.slice(2);
  }, [rankedByCapital]);

  // Filtered & Sorted list for the Performance Table
  const tableStartups = useMemo(() => {
    const baseList = viewScope === "remaining" ? remainingStartups : rankedByCapital;

    // Search filter
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? baseList.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.industry?.toLowerCase().includes(query) ||
            s.tagLine?.toLowerCase().includes(query)
        )
      : baseList;

    // Sort by selected metric
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "capital":
          return (b.totalInvestmentReceived || 0) - (a.totalInvestmentReceived || 0);
        case "price":
          return (b.currentPrice || 0) - (a.currentPrice || 0);
        case "change": {
          const aOpen = a.openPrice || a.initialPrice || 100;
          const aChg = a.percentageChange ?? (((a.currentPrice - aOpen) / aOpen) * 100);
          const bOpen = b.openPrice || b.initialPrice || 100;
          const bChg = b.percentageChange ?? (((b.currentPrice - bOpen) / bOpen) * 100);
          return bChg - aChg;
        }
        case "marketCap": {
          const aCap = (a.totalShares || 1000000) * a.currentPrice;
          const bCap = (b.totalShares || 1000000) * b.currentPrice;
          return bCap - aCap;
        }
        case "volume":
          return (b.totalVolume || 0) - (a.totalVolume || 0);
        case "backers":
          return (b.investorCount || 0) - (a.investorCount || 0);
        default:
          return 0;
      }
    });
  }, [viewScope, remainingStartups, rankedByCapital, searchQuery, sortBy]);

  // Helper for company metrics
  const getMetrics = (startup: StartupItem) => {
    const sub = getSubscriptionStatus(startup.totalInvestmentReceived, startup.fundingAsk);
    const openP = startup.openPrice || startup.initialPrice || 100;
    const chg = startup.priceChange ?? Number((startup.currentPrice - openP).toFixed(2));
    const pct =
      startup.percentageChange ??
      Number((((startup.currentPrice - openP) / openP) * 100).toFixed(2));
    const stat = formatPriceChange(chg, pct);
    const isPos = chg >= 0;
    const marketCap = (startup.totalShares || 1000000) * startup.currentPrice;
    return { sub, chg, pct, stat, isPos, marketCap };
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-16 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Page Header */}
      <div className="text-center space-y-2 pt-2 sm:pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>VENTURE RANKINGS & PODIUM</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
          Live Venture Leaderboard
        </h1>
        <p className="text-xs sm:text-sm font-mono text-zinc-400 max-w-xl mx-auto">
          Real-time performance rankings based on investor capital raised, share price growth, and market valuation.
        </p>
      </div>

      {/* TOP 2 PODIUM TILES: 1st Place Company (Compact) followed by 2nd Place Company */}
      {loading && !firstPlace ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
          <div className="h-72 rounded-3xl border border-white/10 bg-white/[0.03] animate-pulse" />
          <div className="h-72 rounded-3xl border border-white/10 bg-white/[0.03] animate-pulse" />
        </div>
      ) : !firstPlace ? (
        <Card className="glass-panel-premium p-10 text-center text-zinc-400 font-mono text-xs border-white/10">
          No startup companies currently ranked.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2 items-stretch">
          {/* TILE 1: 1ST PLACE COMPANY (Sleeker & More Compact) */}
          {firstPlace && (() => {
            const m = getMetrics(firstPlace);
            return (
              <motion.div
                key={firstPlace.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col h-full"
              >
                <Card className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-400/40 bg-gradient-to-b from-amber-950/20 via-[#0a0f1c]/90 to-[#060911]/90 shadow-[0_0_30px_rgba(245,158,11,0.14)] hover:border-amber-400/60 backdrop-blur-2xl transition-all duration-300">
                  {/* Glowing Top Ribbon */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]" />

                  <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-400/50 bg-amber-400/15 text-amber-300 font-mono text-[11px] font-black shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                        <Crown className="h-3.5 w-3.5" />
                        <span>1ST PLACE • CHAMPION</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider truncate max-w-[150px]">
                        {firstPlace.industry}
                      </span>
                    </div>

                    {/* Startup Title & Tagline */}
                    <div className="space-y-1">
                      <CardTitle className="text-xl sm:text-2xl font-black text-white hover:text-amber-300 transition-colors">
                        <Link href={`/startup/${firstPlace.slug}`}>{firstPlace.name}</Link>
                      </CardTitle>
                      <p className="text-xs text-zinc-400 line-clamp-1 leading-normal">
                        {firstPlace.tagLine || firstPlace.pitchSummary}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                    {/* Capital Raised Hero Pill */}
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                          Capital Raised
                        </span>
                        <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                          {formatINR(firstPlace.totalInvestmentReceived)}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {m.sub.label}
                      </span>
                    </div>

                    {/* Compact Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-center font-mono">
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Stock Price</span>
                        <span className="text-xs sm:text-sm font-bold text-white block">
                          {formatSharePrice(firstPlace.currentPrice)}
                        </span>
                        <span className={`text-[10px] block font-bold ${m.stat.textClass}`}>
                          {m.isPos ? "+" : ""}
                          {m.stat.text}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Market Cap</span>
                        <span className="text-xs sm:text-sm font-bold text-amber-200 block truncate">
                          {formatINR(m.marketCap)}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">Valuation</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Backers</span>
                        <span className="text-xs sm:text-sm font-bold text-cyan-300 block">
                          {firstPlace.investorCount || 0}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">Investors</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 sm:p-5 pt-0 border-t border-white/[0.06] mt-auto">
                    <Link
                      href={`/startup/${firstPlace.slug}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 hover:text-white font-mono text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      Trade Stock <ArrowUpRight className="h-3.5 w-3.5 text-amber-300" />
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })()}

          {/* TILE 2: 2ND PLACE COMPANY (Placed Right After 1st Place) */}
          {secondPlace ? (() => {
            const m = getMetrics(secondPlace);
            return (
              <motion.div
                key={secondPlace.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="flex flex-col h-full"
              >
                <Card className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-300/30 bg-gradient-to-b from-slate-900/40 via-[#0a0f1c]/90 to-[#060911]/90 shadow-[0_0_25px_rgba(203,213,225,0.08)] hover:border-slate-300/50 backdrop-blur-2xl transition-all duration-300">
                  {/* Top Slate Line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 shadow-[0_0_15px_rgba(203,213,225,0.4)]" />

                  <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300/50 bg-slate-300/15 text-slate-200 font-mono text-[11px] font-black shadow-[0_0_10px_rgba(203,213,225,0.2)]">
                        <Medal className="h-3.5 w-3.5" />
                        <span>2ND PLACE • RUNNER-UP</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider truncate max-w-[150px]">
                        {secondPlace.industry}
                      </span>
                    </div>

                    {/* Startup Title & Tagline */}
                    <div className="space-y-1">
                      <CardTitle className="text-xl sm:text-2xl font-black text-white hover:text-slate-200 transition-colors">
                        <Link href={`/startup/${secondPlace.slug}`}>{secondPlace.name}</Link>
                      </CardTitle>
                      <p className="text-xs text-zinc-400 line-clamp-1 leading-normal">
                        {secondPlace.tagLine || secondPlace.pitchSummary}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                    {/* Capital Raised Hero Pill */}
                    <div className="rounded-xl border border-slate-300/20 bg-slate-300/[0.04] p-3 flex items-baseline justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                          Capital Raised
                        </span>
                        <span className="text-xl sm:text-2xl font-mono font-black text-slate-100">
                          {formatINR(secondPlace.totalInvestmentReceived)}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {m.sub.label}
                      </span>
                    </div>

                    {/* Compact Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-center font-mono">
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Stock Price</span>
                        <span className="text-xs sm:text-sm font-bold text-white block">
                          {formatSharePrice(secondPlace.currentPrice)}
                        </span>
                        <span className={`text-[10px] block font-bold ${m.stat.textClass}`}>
                          {m.isPos ? "+" : ""}
                          {m.stat.text}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Market Cap</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-200 block truncate">
                          {formatINR(m.marketCap)}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">Valuation</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Backers</span>
                        <span className="text-xs sm:text-sm font-bold text-cyan-300 block">
                          {secondPlace.investorCount || 0}
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate">Investors</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 sm:p-5 pt-0 border-t border-white/[0.06] mt-auto">
                    <Link
                      href={`/startup/${secondPlace.slug}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300/30 bg-slate-300/10 text-slate-200 hover:bg-slate-300/20 hover:text-white font-mono text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      Trade Stock <ArrowUpRight className="h-3.5 w-3.5 text-slate-300" />
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })() : (
            /* Placeholder if only 1 company is registered */
            <div className="flex flex-col h-full rounded-2xl sm:rounded-3xl border border-dashed border-white/10 bg-white/[0.01] p-6 items-center justify-center text-center space-y-2">
              <div className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-zinc-400">
                <Medal className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-zinc-300 font-mono">2nd Place Slot Open</h3>
              <p className="text-xs text-zinc-500 font-mono max-w-xs">
                As additional startups pitch and raise investor capital, the 2nd place runner-up will be showcased here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PERFORMANCE RANKINGS TABLE (All the rest of the companies) */}
      <div className="space-y-4 pt-2">
        {/* Table Controls & Filter Toolbar */}
        <Card className="rounded-2xl border border-white/10 bg-[#0a0f1c]/80 backdrop-blur-xl p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Performance Leaderboard
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-semibold">
                  {viewScope === "remaining" ? "Rank #3 & Below" : "All Startups"}
                </span>
              </div>
              <p className="text-xs font-mono text-zinc-400 mt-0.5">
                Comprehensive rankings of competing startup ventures ordered by live performance metrics.
              </p>
            </div>

            {/* Toolbar Buttons & Inputs */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative min-w-[180px] sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Filter company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs font-mono bg-black/40 border-white/10 text-white placeholder-zinc-500"
                />
              </div>

              {/* Metric Sort Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8 rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs font-mono text-zinc-200 outline-none hover:border-white/20"
                >
                  <option value="capital">Capital Raised (High to Low)</option>
                  <option value="price">Share Price (High to Low)</option>
                  <option value="change">Price Return % (Gainers)</option>
                  <option value="marketCap">Market Cap (High to Low)</option>
                  <option value="volume">Trading Volume</option>
                  <option value="backers">Backers Count</option>
                </select>
              </div>

              {/* View Scope Toggle (Remaining vs All) */}
              <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setViewScope("remaining")}
                  className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                    viewScope === "remaining"
                      ? "bg-cyan-500 text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Rest of Field
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope("all")}
                  className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                    viewScope === "all"
                      ? "bg-cyan-500 text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  All Teams
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* The Rankings Table */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0f1c]/90 backdrop-blur-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          {tableStartups.length === 0 ? (
            <div className="p-10 text-center space-y-3 font-mono">
              <div className="inline-flex h-12 w-12 rounded-full border border-white/10 bg-white/5 items-center justify-center text-zinc-400">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200">
                {viewScope === "remaining" && rankedByCapital.length <= 2
                  ? "All Registered Companies Are Currently on the Podium"
                  : "No Companies Match Your Search Query"}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                {viewScope === "remaining" && rankedByCapital.length <= 2
                  ? "There are currently only 1 or 2 teams registered. Startups ranking #3 and below will automatically display in this table as more teams pitch."
                  : "Try clearing your search query or switching filters to view other teams."}
              </p>
              {viewScope === "remaining" && rankedByCapital.length <= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewScope("all")}
                  className="font-mono text-xs border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                >
                  View All Companies in Table
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/[0.03] border-b border-white/10 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead>Company / Sector</TableHead>
                    <TableHead className="text-right">Capital Raised</TableHead>
                    <TableHead className="text-right">Share Price (LTP)</TableHead>
                    <TableHead className="text-right">Market Cap</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-center">Backers</TableHead>
                    <TableHead className="text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableStartups.map((startup) => {
                    const globalRank = rankedByCapital.findIndex((item) => item.id === startup.id) + 1;
                    const isThird = globalRank === 3;
                    const m = getMetrics(startup);

                    return (
                      <TableRow
                        key={startup.id}
                        className="border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Rank Column */}
                        <TableCell className="text-center font-mono font-bold">
                          {isThird ? (
                            <div className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md border border-amber-700/50 bg-amber-700/20 text-amber-400 text-xs shadow-[0_0_8px_rgba(180,83,9,0.2)]">
                              <Award className="h-3.5 w-3.5" />
                              <span>#3</span>
                            </div>
                          ) : globalRank === 1 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md border border-amber-400/50 bg-amber-400/20 text-amber-300 text-xs">
                              #1
                            </span>
                          ) : globalRank === 2 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md border border-slate-300/50 bg-slate-300/20 text-slate-200 text-xs">
                              #2
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-zinc-400">
                              #{globalRank}
                            </span>
                          )}
                        </TableCell>

                        {/* Company & Sector */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/startup/${startup.slug}`}
                                className="font-bold text-white hover:text-cyan-300 transition-colors text-sm flex items-center gap-1"
                              >
                                {startup.name}
                                <span className="text-[10px] text-zinc-500">↗</span>
                              </Link>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-white/10 bg-white/5 text-zinc-400">
                                {startup.industry}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-xs sm:max-w-md">
                              {startup.tagLine || startup.pitchSummary}
                            </p>
                          </div>
                        </TableCell>

                        {/* Capital Raised */}
                        <TableCell className="text-right font-mono">
                          <span className="text-sm font-bold text-white block">
                            {formatINR(startup.totalInvestmentReceived)}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-400 block">
                            {m.sub.label}
                          </span>
                        </TableCell>

                        {/* Stock Price & Change */}
                        <TableCell className="text-right font-mono">
                          <span className="text-sm font-bold text-white block">
                            {formatSharePrice(startup.currentPrice)}
                          </span>
                          <span className={`text-[10px] block font-bold ${m.stat.textClass}`}>
                            {m.isPos ? "+" : ""}
                            {m.stat.text}
                          </span>
                        </TableCell>

                        {/* Market Cap */}
                        <TableCell className="text-right font-mono text-xs font-bold text-zinc-200">
                          {formatINR(m.marketCap)}
                        </TableCell>

                        {/* Volume */}
                        <TableCell className="text-right font-mono text-xs text-zinc-400">
                          {(startup.totalVolume || 0).toLocaleString()} sh
                        </TableCell>

                        {/* Backers */}
                        <TableCell className="text-center font-mono text-xs font-semibold text-cyan-300">
                          {startup.investorCount || 0}
                        </TableCell>

                        {/* Trade Action */}
                        <TableCell className="text-right pr-4">
                          <Link
                            href={`/startup/${startup.slug}`}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-white/10 bg-white/5 text-zinc-200 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-white font-mono text-[11px] font-bold transition-all"
                          >
                            Trade <ArrowUpRight className="h-3 w-3 text-cyan-400" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
