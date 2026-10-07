"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR, formatSharePrice, formatPriceChange, formatDate, getSubscriptionStatus } from "@/lib/formatters";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Award,
  Radio,
  Users,
  Activity,
  ShieldAlert,
  Sparkles,
  Search,
  ArrowUpRight,
  Flame,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StartupItem, ActivityFeedItem } from "@/types";

export default function MarketTerminalPage() {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [marketData, setMarketData] = useState<{
    isMarketActive: boolean;
    bannerMessage?: string | null;
    totalMarketInvestment: number;
    totalRetailInvestment: number;
    totalFIIInvestment: number;
    totalVolume?: number;
    activeInvestorsCount: number;
    stocks?: StartupItem[];
    leaderboard: StartupItem[];
    topGainers?: StartupItem[];
    topLosers?: StartupItem[];
    mostTraded?: StartupItem[];
    recentActivities: ActivityFeedItem[];
    chartTrends: any[];
  } | null>(null);

  const [marketTab, setMarketTab] = useState<"ALL" | "GAINERS" | "LOSERS" | "MOST_TRADED" | "IPO_LIVE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const cacheRef = React.useRef<string>("");

  const fetchMarketData = async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/market/overview", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text !== cacheRef.current) {
          cacheRef.current = text;
          setMarketData(JSON.parse(text));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 3000); // 3s smooth sync
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const stocks = marketData?.stocks || marketData?.leaderboard || [];
  const leaderboard = marketData?.leaderboard || [];
  const activities = marketData?.recentActivities || [];
  const chartTrends = marketData?.chartTrends || [];

  // Filter stocks according to tab & search query
  const filteredStocks = stocks.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.industry.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (marketTab === "GAINERS") {
      return (s.percentageChange ?? 0) > 0;
    }
    if (marketTab === "LOSERS") {
      return (s.percentageChange ?? 0) < 0;
    }
    if (marketTab === "MOST_TRADED") {
      return (s.totalVolume ?? 0) > 0;
    }
    if (marketTab === "IPO_LIVE") {
      return s.ipoStatus === "IPO_OPEN";
    }
    return true;
  });

  const retail = marketData?.totalRetailInvestment || 0;
  const fii = marketData?.totalFIIInvestment || 0;
  const donutData = [
    { name: "Audience Inflow", value: retail },
    { name: "FII Institutional", value: fii },
  ];
  const DONUT_COLORS = ["#00e599", "#f59e0b"];
  const LINE_COLORS = ["#00e599", "#00c8ff", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

  return (
    <div
      ref={containerRef}
      className={`space-y-8 sm:space-y-10 pb-16 transition-all duration-300 ${
        isFullscreen ? "p-6 sm:p-10 bg-[#060911] min-h-screen overflow-y-auto" : ""
      }`}
    >
      {/* Banner Message Broadcast */}
      {marketData?.bannerMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 via-emerald-500/10 to-cyan-500/15 p-4 px-6 text-center font-mono text-xs sm:text-sm font-bold text-cyan-300 backdrop-blur-xl shadow-[0_0_25px_rgba(0,200,255,0.15)] animate-pulse"
        >
          📢 {marketData.bannerMessage}
        </motion.div>
      )}

      {/* Auditorium Screen Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4 sm:pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Live Stock Market
          </h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Real-time price discovery, order execution telemetry, and valuation rankings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Market status indicator */}
          {marketData === null ? (
            <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/20 bg-white/5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-mono text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
              CONNECTING...
            </span>
          ) : marketData.isMarketActive ? (
            <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-mono font-bold text-emerald-400 shadow-[0_0_15px_rgba(0,229,153,0.2)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              MARKET LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-rose-500/50 bg-rose-500/20 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-mono font-bold text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-pulse">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
              MARKET PAUSED
            </span>
          )}

          {/* Fullscreen Projector Toggle */}
          <Button
            onClick={toggleFullscreen}
            variant="outline"
            className="h-10 sm:h-11 px-3.5 sm:px-5 gap-2 sm:gap-2.5 font-mono text-xs border-white/20 bg-white/5 hover:bg-white/10 hover:border-cyan-500/40 text-white rounded-xl transition-all active:scale-95"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-cyan-400" />
            )}
            <span className="hidden xs:inline">{isFullscreen ? "Exit Projector" : "Projector Mode"}</span>
          </Button>
        </div>
      </div>

      {/* Live Market Ticker Strip */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {stocks.map((stock) => {
          const openP = stock.openPrice || stock.initialPrice || 100;
          const chg = stock.priceChange ?? Number((stock.currentPrice - openP).toFixed(2));
          const pct = stock.percentageChange ?? Number((((stock.currentPrice - openP) / openP) * 100).toFixed(2));
          const stat = formatPriceChange(chg, pct);

          return (
            <Link
              key={stock.id}
              href={`/startup/${stock.slug}`}
              prefetch={true}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-emerald-500/40 hover:bg-white/[0.06] transition-all shrink-0 font-mono text-xs shadow-sm"
            >
              <span className="font-bold text-white">{stock.name}</span>
              <span className="font-black text-emerald-400">{formatSharePrice(stock.currentPrice)}</span>
              <span className={`text-[11px] font-bold ${stat.textClass}`}>
                {chg >= 0 ? "+" : ""}
                {pct.toFixed(1)}%
              </span>
            </Link>
          );
        })}
      </div>

      {/* Global Macro Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
        <Card className="glass-panel-premium p-4 sm:p-6 border-white/[0.08]">
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
            Gross Market Turnover
          </span>
          <span className="text-lg sm:text-3xl lg:text-4xl font-mono font-black text-emerald-400 mt-1 sm:mt-2 block truncate">
            {formatINR(marketData?.totalMarketInvestment || 0)}
          </span>
        </Card>

        <Card className="glass-panel-premium p-4 sm:p-6 border-white/[0.08]">
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
            FII Institutional Cheques
          </span>
          <span className="text-lg sm:text-3xl lg:text-4xl font-mono font-black text-amber-400 mt-1 sm:mt-2 block truncate">
            {formatINR(marketData?.totalFIIInvestment || 0)}
          </span>
        </Card>

        <Card className="glass-panel-premium p-4 sm:p-6 border-white/[0.08]">
          <span className="text-[10px] sm:text-[11px] font-mono text-zinc-400 uppercase tracking-wider font-semibold block">
            Total Traded Volume
          </span>
          <span className="text-lg sm:text-3xl lg:text-4xl font-mono font-black text-white mt-1 sm:mt-2 block truncate">
            {marketData?.totalVolume?.toLocaleString("en-IN") || 0}
            <span className="text-xs font-mono text-zinc-400 font-normal ml-1">shares</span>
          </span>
        </Card>
      </div>

      {/* Stocks Market Board with Filters & Search */}
      <Card className="glass-panel-premium p-5 sm:p-8 border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-400" />
              Listed Stocks Exchange Board
            </h2>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">
              Click any stock to open its full trading terminal.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search stock or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 font-mono text-xs bg-white/5 border-white/10 text-white rounded-xl"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: "ALL", label: "All Stocks" },
            { key: "GAINERS", label: "Top Gainers" },
            { key: "LOSERS", label: "Top Losers" },
            { key: "MOST_TRADED", label: "Most Traded" },
            { key: "IPO_LIVE", label: "IPO Live" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMarketTab(tab.key as any)}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shrink-0 ${
                marketTab === tab.key
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                  : "border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stock List Table */}
        {filteredStocks.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Stock / Company</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>LTP (Current)</TableHead>
                  <TableHead>24h Change</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocks.map((s) => {
                  const openP = s.openPrice || s.initialPrice || 100;
                  const chg = s.priceChange ?? Number((s.currentPrice - openP).toFixed(2));
                  const pct = s.percentageChange ?? Number((((s.currentPrice - openP) / openP) * 100).toFixed(2));
                  const stat = formatPriceChange(chg, pct);
                  const isPos = chg >= 0;

                  return (
                    <TableRow key={s.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-bold text-white">
                        <Link href={`/startup/${s.slug}`} prefetch={true} className="hover:text-cyan-400 flex items-center gap-1.5">
                          <span>{s.name}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-cyan-400 uppercase">{s.industry}</TableCell>
                      <TableCell className="font-mono font-black text-sm text-white">
                        {formatSharePrice(s.currentPrice)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${stat.badgeClass}`}
                        >
                          {isPos ? "+" : ""}
                          {stat.text}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300">
                        {s.totalVolume?.toLocaleString("en-IN") || 0} shares
                      </TableCell>
                      <TableCell className="font-mono font-bold text-white">
                        {formatINR((s.totalShares || 1000000) * s.currentPrice)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={s.ipoStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => router.push(`/startup/${s.slug}`)}
                          className="h-8 px-3 rounded-lg font-mono text-xs bg-emerald-500 text-black hover:bg-emerald-400 font-bold"
                        >
                          Trade Stock
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs font-mono text-zinc-500">
            No stocks found matching the selected filter.
          </div>
        )}
      </Card>

      {/* Stage Valuation Leaderboard & Retail vs FII Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
        {/* Dynamic Leaderboard (2 Cols) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-400" /> Stage Valuation Leaderboard
            </h2>
          </div>

          <div className="space-y-3">
            {leaderboard.map((startup, index) => {
              const subState = getSubscriptionStatus(startup.totalInvestmentReceived, startup.fundingAsk);

              return (
                <motion.div
                  key={startup.id}
                  layout
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent p-4 sm:p-5 flex items-center justify-between gap-4 backdrop-blur-xl hover:border-emerald-500/40 transition-all"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <span
                      className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl font-mono text-sm sm:text-base font-black border ${
                        index === 0
                          ? "border-amber-400/50 bg-amber-400/20 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                          : index === 1
                          ? "border-cyan-400/50 bg-cyan-400/20 text-cyan-300 shadow-[0_0_15px_rgba(0,200,255,0.3)]"
                          : index === 2
                          ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300 shadow-[0_0_15px_rgba(0,229,153,0.3)]"
                          : "border-white/10 bg-white/5 text-zinc-400"
                      }`}
                    >
                      #{index + 1}
                    </span>

                    <div>
                      <Link href={`/startup/${startup.slug}`} prefetch={true} className="text-base sm:text-lg font-bold text-white hover:text-cyan-400 transition-colors">
                        {startup.name}
                      </Link>
                      <span className="block text-xs font-mono text-zinc-400 mt-0.5">
                        LTP: <strong className="text-emerald-400">{formatSharePrice(startup.currentPrice)}</strong> • {startup.investorCount} Backers
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base sm:text-xl font-mono font-black text-white">
                      {formatINR(startup.totalInvestmentReceived)}
                    </span>
                    <span className={`block text-[11px] font-mono font-bold mt-0.5 ${subState.badgeClass} px-2 py-0.5 rounded-full inline-block`}>
                      {subState.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Investor Donut Breakdown & Activity Stream (1 Col) */}
        <div className="space-y-6">
          <Card className="glass-panel-premium p-5 sm:p-6 border-white/10">
            <h3 className="text-sm font-bold text-white mb-3">Audience vs Institutional Inflow</h3>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0];
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#0c111e] p-2.5 font-mono text-xs shadow-xl">
                            <span className="text-white font-bold block">{d.name}</span>
                            <span className="text-emerald-400 font-bold block mt-0.5">
                              {formatINR(Number(d.value))}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Activity Feed */}
          <Card className="glass-panel-premium p-5 sm:p-6 border-white/10 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" /> Real-Time Event Ticker
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activities.slice(0, 10).map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs font-mono text-zinc-300"
                >
                  <p className="leading-snug">{act.message}</p>
                  <span className="text-[10px] text-zinc-500 block mt-1">{formatDate(act.createdAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
