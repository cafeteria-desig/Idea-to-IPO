"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { useAuth } from "@/context/AuthContext";
import {
  formatINR,
  formatSharePrice,
  formatPriceChange,
  formatDate,
  getSubscriptionStatus,
} from "@/lib/formatters";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Zap,
  Users,
  Wallet,
  Star,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  FileText,
  Key,
  Copy,
  Check,
  Lock,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TeamReportModal } from "@/components/TeamReportModal";
import type {
  StartupItem,
  TradeItem,
  HoldingItem,
  PriceHistoryPoint,
} from "@/types";

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const slug = params?.slug as string;

  const [startup, setStartup] = useState<StartupItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [restrictedData, setRestrictedData] = useState<{
    isRestricted?: boolean;
    message?: string;
    myStartupSlug?: string | null;
    myStartupName?: string | null;
  } | null>(null);

  // Trading Ticket State (Groww Style)
  const [tradeSide, setTradeSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState<number>(50);
  const [limitPrice, setLimitPrice] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [tradeFeedback, setTradeFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Chart Timeframe State
  const [chartRange, setChartRange] = useState<string>("1D");
  const [chartData, setChartData] = useState<PriceHistoryPoint[]>([]);

  // Live Feed State
  const [recentTrades, setRecentTrades] = useState<TradeItem[]>([]);
  const [userHolding, setUserHolding] = useState<HoldingItem | null>(null);
  const [isWatchlisted, setIsWatchlisted] = useState(false);

  const limitPriceSetRef = React.useRef(false);

  // 1. Fetch Startup & Stock Details
  const fetchStartupDetail = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/startups/${slug}`, { cache: "no-store" });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setRestrictedData(data);
        setStartup(null);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStartup(data);
        setRestrictedData(null);
        if (!limitPriceSetRef.current && data.currentPrice) {
          limitPriceSetRef.current = true;
          setLimitPrice(data.currentPrice);
        }
      }
    } catch (err) {
      console.error("Failed to load startup detail:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // 2. Fetch Chart Data
  const fetchChartData = useCallback(async () => {
    if (!startup?.id) return;
    try {
      const res = await fetch(`/api/trade/chart?startupId=${startup.id}&range=${chartRange}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setChartData(json.data);
        }
      }
    } catch (err) {
      console.error("Failed to load chart data:", err);
    }
  }, [startup?.id, chartRange]);

  // 3. Fetch Recent Trades (Admin Only)
  const fetchRecentTrades = useCallback(async () => {
    if (!startup?.id || user?.role !== "ADMIN") {
      setRecentTrades([]);
      return;
    }
    try {
      const trRes = await fetch(`/api/trade/recent-trades?startupId=${startup.id}&limit=15`, { cache: "no-store" });
      if (trRes.ok) {
        const tr = await trRes.json();
        if (tr.success && Array.isArray(tr.trades)) {
          setRecentTrades(tr.trades);
        }
      }
    } catch (err) {
      console.error("Failed to load recent trades:", err);
    }
  }, [startup?.id, user?.role]);

  // 4. Fetch User's Position / Holding on this stock
  const fetchUserHolding = useCallback(async () => {
    if (!user || !startup?.id) return;
    try {
      const res = await fetch(`/api/trade/holdings?userId=${user.id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.holdings)) {
          const matched = json.holdings.find((h: HoldingItem) => h.startupId === startup.id);
          setUserHolding(matched || null);
        }
      }
    } catch (err) {
      console.error("Failed to load user holding:", err);
    }
  }, [user, startup?.id]);

  // 5. Check Watchlist Status
  const fetchWatchlistStatus = useCallback(async () => {
    if (!user || !startup?.id) return;
    try {
      const res = await fetch(`/api/trade/watchlist?userId=${user.id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.watchlist)) {
          const inList = json.watchlist.some((w: any) => w.startupId === startup.id);
          setIsWatchlisted(inList);
        }
      }
    } catch (err) {
      console.error("Watchlist check error:", err);
    }
  }, [user, startup?.id]);

  useEffect(() => {
    fetchStartupDetail();
  }, [fetchStartupDetail]);

  useEffect(() => {
    if (startup?.id) {
      fetchChartData();
      fetchRecentTrades();
      fetchUserHolding();
      fetchWatchlistStatus();

      const interval = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        fetchStartupDetail();
        fetchRecentTrades();
        fetchUserHolding();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [startup?.id, fetchChartData, fetchRecentTrades, fetchUserHolding, fetchWatchlistStatus, fetchStartupDetail]);

  useEffect(() => {
    if (startup?.id) {
      fetchChartData();
    }
  }, [chartRange, fetchChartData, startup?.id]);

  // Watchlist Toggle
  const handleToggleWatchlist = async () => {
    if (!user || !startup) return;
    try {
      const res = await fetch("/api/trade/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startupId: startup.id, userId: user.id }),
      });
      if (res.ok) {
        const json = await res.json();
        setIsWatchlisted(json.inWatchlist);
      }
    } catch (err) {
      console.error("Failed to toggle watchlist:", err);
    }
  };

  // Execute Buy / Sell Order
  const handleConfirmOrder = async () => {
    if (!user || !startup) return;
    setIsSubmitting(true);
    setTradeFeedback(null);

    try {
      const payload = {
        userId: user.id,
        startupId: startup.id,
        side: tradeSide,
        type: orderType,
        quantity: Number(quantity),
        price: orderType === "LIMIT" ? Number(limitPrice) : undefined,
      };

      const res = await fetch("/api/trade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        confetti({
          particleCount: 130,
          spread: 75,
          origin: { y: 0.6 },
          colors: tradeSide === "BUY" ? ["#00e599", "#00c8ff", "#ffffff"] : ["#ef4444", "#f59e0b", "#ffffff"],
        });

        setTradeFeedback({
          success: true,
          message: data.message || `Order successfully executed!`,
        });

        await refreshUser();
        await fetchStartupDetail();
        await fetchRecentTrades();
        await fetchUserHolding();
        await fetchChartData();

        setTimeout(() => {
          setConfirmModalOpen(false);
          setTradeFeedback(null);
        }, 2200);
      } else {
        setTradeFeedback({
          success: false,
          message: data.message || "Order placement failed.",
        });
      }
    } catch (err) {
      setTradeFeedback({
        success: false,
        message: "Network connection error while submitting trade.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse py-8">
        <div className="h-10 w-64 bg-white/10 rounded-2xl" />
        <div className="h-96 bg-white/[0.04] rounded-3xl" />
      </div>
    );
  }

  if (restrictedData) {
    return (
      <div className="py-20 max-w-lg mx-auto text-center space-y-6">
        <div className="h-16 w-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-xl">
          <Lock className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">Company Isolation Active</h2>
          <p className="text-xs font-mono text-zinc-400 leading-relaxed">
            {restrictedData.message ||
              "Under exchange governance, company founder accounts are restricted to viewing only their own company's performance stats."}
          </p>
        </div>
        {restrictedData.myStartupSlug ? (
          <Button
            onClick={() => router.push(`/startup/${restrictedData.myStartupSlug}`)}
            className="font-mono text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 gap-2 shadow-lg shadow-cyan-500/25"
          >
            Go to My Company Page ({restrictedData.myStartupName || "My Venture"})
          </Button>
        ) : (
          <Button
            onClick={() => router.push("/teams")}
            className="font-mono text-xs font-bold bg-white/10 text-white hover:bg-white/20"
          >
            Return to Teams
          </Button>
        )}
      </div>
    );
  }

  if (!startup) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Stock Not Found</h2>
        <Link href="/teams" className="text-emerald-400 font-mono text-sm underline">
          Return to Market Roster
        </Link>
      </div>
    );
  }

  const currentPrice = startup.currentPrice || 100;
  const openPrice = startup.openPrice || startup.initialPrice || 100;
  const priceChange = startup.priceChange ?? Number((currentPrice - openPrice).toFixed(2));
  const percentageChange = startup.percentageChange ?? Number((((currentPrice - openPrice) / openPrice) * 100).toFixed(2));
  const priceStats = formatPriceChange(priceChange, percentageChange);
  const sub = getSubscriptionStatus(startup.totalInvestmentReceived, startup.fundingAsk);
  const isOpen = startup.ipoStatus === "IPO_OPEN" && !startup.isSuspended;

  // Calculation for trade ticket
  const effectivePrice = orderType === "LIMIT" ? limitPrice : currentPrice;
  const estimatedTotal = Math.round(quantity * effectivePrice);
  const userCash = user?.currentBalance || 0;
  const sharesOwned = userHolding?.quantity || 0;
  const avgBuyPrice = userHolding?.averageBuyPrice || currentPrice;
  const estimatedSellPnL = tradeSide === "SELL" ? Math.round(quantity * (effectivePrice - avgBuyPrice)) : 0;

  // Chart stroke and gradient based on change
  const isPositive = priceChange >= 0;
  const chartStrokeColor = isPositive ? "#00e599" : "#ef4444";
  const chartFillId = isPositive ? "emeraldGrad" : "roseGrad";

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* Navigation breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/teams"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Market Roster
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-mono font-semibold transition-all shadow-sm shadow-emerald-500/10"
          >
            <FileText className="h-3.5 w-3.5" />
            Investor Report & Cap Table
          </button>
          <button
            onClick={handleToggleWatchlist}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
              isWatchlisted
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                : "border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:border-white/20"
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isWatchlisted ? "fill-amber-400 text-amber-400" : ""}`} />
            {isWatchlisted ? "Watchlisted" : "Add to Watchlist"}
          </button>
        </div>
      </div>

      {/* Main Stock Header Card */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#0e1424]/90 via-[#0a0f1c]/90 to-[#060911]/90 p-5 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-500 shadow-md" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Company identity & Pitch Badge */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs font-mono font-bold text-zinc-300">
                PITCH #{startup.pitchOrder}
              </span>
              {startup.token && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(startup.token || "");
                    setTokenCopied(true);
                    setTimeout(() => setTokenCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/35 px-2.5 py-0.5 text-xs font-mono font-bold text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm"
                  title="Click to copy Company Access Token"
                >
                  <Key className="h-3 w-3" /> Token #{startup.token}
                  {tokenCopied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-amber-400/60" />
                  )}
                </button>
              )}
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                {startup.industry}
              </span>
              <StatusBadge status={startup.ipoStatus} />
              {startup.isSuspended && (
                <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-0.5 text-xs font-mono font-bold">
                  SUSPENDED
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              {startup.name}
              <span className="text-xs font-mono font-normal text-zinc-500 uppercase px-2 py-0.5 rounded border border-white/10 bg-white/5">
                NSE-SIM: {startup.slug.toUpperCase()}
              </span>
            </h1>

            <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
              {startup.tagLine}
            </p>
          </div>

          {/* Real-time Price & Market Metrics */}
          <div className="flex flex-wrap lg:flex-col lg:items-end justify-between items-center gap-2 border-t lg:border-t-0 border-white/10 pt-4 lg:pt-0">
            <div className="text-left lg:text-right">
              <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Last Traded Price (LTP)
              </span>
              <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight drop-shadow-sm">
                {formatSharePrice(currentPrice)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold border ${priceStats.badgeClass}`}
              >
                {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {priceStats.text}
              </span>
            </div>
          </div>
        </div>

        {/* Financial telemetry strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-white/10 bg-[#060911]/70 p-4 mt-6">
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 uppercase">24h High</span>
            <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
              {formatSharePrice(startup.dayHigh || currentPrice)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 uppercase">24h Low</span>
            <span className="text-sm sm:text-base font-mono font-bold text-rose-400">
              {formatSharePrice(startup.dayLow || currentPrice)}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 uppercase">Traded Volume</span>
            <span className="text-sm sm:text-base font-mono font-bold text-cyan-400">
              {startup.totalVolume?.toLocaleString("en-IN") || 0} shares
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 uppercase">Market Cap</span>
            <span className="text-sm sm:text-base font-mono font-bold text-amber-400">
              {formatINR((startup.totalShares || 1000000) * currentPrice)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Grid: Left = Chart + Order Book + Dossier; Right = Groww Trading Terminal + Holding Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left Column (2 Cols on desktop): Interactive Chart, Order Book, Pitch Info */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          {/* Interactive Price Chart */}
          <Card className="glass-panel-premium p-5 sm:p-7 border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Live Price Discovery Chart</h3>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 self-start sm:self-auto">
                {["5M", "30M", "1H", "1D", "ALL"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      chartRange === range
                        ? "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-72 sm:h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e599" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00e599" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    fontFamily="monospace"
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    domain={["auto", "auto"]}
                    tickLine={false}
                    fontFamily="monospace"
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#0c111e]/95 p-3 font-mono text-xs shadow-2xl backdrop-blur-xl">
                            <span className="text-zinc-400 block">{d.timeLabel || d.timestamp}</span>
                            <span className="text-emerald-400 font-bold text-sm block mt-1">
                              Price: {formatSharePrice(d.price)}
                            </span>
                            {d.volume > 0 && (
                              <span className="text-cyan-300 block text-[11px] mt-0.5">
                                Volume: {d.volume} shares
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={chartStrokeColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#${chartFillId})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recent Executed Trades (Admin Only) */}
          {user?.role === "ADMIN" && (
            <Card className="glass-panel-premium p-5 sm:p-7 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-bold text-white">Recent Executed Trades</h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider">
                  Admin Telemetry
                </span>
              </div>

              {recentTrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Execution Time</TableHead>
                        <TableHead>Trade Price</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTrades.slice(0, 8).map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="font-mono text-xs text-zinc-400">
                            {formatDate(trade.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-emerald-400">
                            {formatSharePrice(trade.price)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-white">
                            {trade.quantity} shares
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-cyan-300">
                            {formatINR(trade.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs font-mono text-zinc-500">
                  No trades executed yet for {startup.name}.
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column (1 Col): Groww Trading Terminal (Investors) OR Founder Performance Console (Founders) */}
        <div className="space-y-6">
          {user?.role === "STARTUP" ? (
            /* Dedicated Founder Performance Command Console */
            <Card className="glass-panel-premium p-5 sm:p-7 border-cyan-500/30 sticky top-24 shadow-2xl bg-gradient-to-b from-[#0a1224]/95 to-[#060a14]/95">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Founder Command Console</h3>
                    <span className="text-[10px] font-mono text-cyan-300">Live Venture Analytics & Cap Table</span>
                  </div>
                </div>
                {startup.token && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(startup.token || "");
                      setTokenCopied(true);
                      setTimeout(() => setTokenCopied(false), 2000);
                    }}
                    className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-xs font-bold hover:bg-amber-500/25 transition-all shadow-sm"
                    title="Click to copy Company Access Token"
                  >
                    <Key className="h-3 w-3" /> Token #{startup.token}
                    {tokenCopied ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-amber-400/60" />
                    )}
                  </button>
                )}
              </div>

              {/* Funding Progress Meter */}
              <div className="space-y-2 mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-400 font-semibold">Funding Target Progress</span>
                  <span className="text-emerald-400 font-bold">{Math.round((sub.ratio || 0) * 100)}% Subscribed</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.min(100, Math.round((sub.ratio || 0) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono pt-1">
                  <span className="text-white font-bold">{formatINR(startup.totalInvestmentReceived)}</span>
                  <span className="text-zinc-400">Target Ask: {formatINR(startup.fundingAsk)}</span>
                </div>
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Retail Investors</span>
                  <span className="text-sm font-mono font-bold text-white block mt-0.5">
                    {formatINR(startup.retailInvestment || 0)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Institutional (FII)</span>
                  <span className="text-sm font-mono font-bold text-cyan-300 block mt-0.5">
                    {formatINR(startup.fiiInvestment || 0)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Total Backers</span>
                  <span className="text-sm font-mono font-bold text-emerald-400 block mt-0.5">
                    {startup.investorCount || 0} Investors
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase block">Market Valuation</span>
                  <span className="text-sm font-mono font-bold text-amber-300 block mt-0.5">
                    {formatINR((startup.totalShares || 1000000) * currentPrice)}
                  </span>
                </div>
              </div>

              {/* Cap Table & Investor Backers */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                    Investor Backers (Cap Table)
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {startup.investments?.length || 0} Bids
                  </span>
                </div>

                {startup.investments && startup.investments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {startup.investments.slice(0, 8).map((inv: any, idx: number) => (
                      <div
                        key={inv.id || idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-mono"
                      >
                        <div>
                          <span className="text-white font-semibold block">
                            {inv.investorName || `Investor #${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase">
                            {inv.investorType || "INVESTOR"}
                          </span>
                        </div>
                        <span className="text-emerald-400 font-bold">
                          {formatINR(inv.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs font-mono text-zinc-500">
                    No bids received yet. Bids placed by audience/judges will appear here in real-time.
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="w-full font-mono text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 gap-1.5 shadow-md shadow-cyan-500/20 py-2.5"
              >
                <FileText className="h-4 w-4" /> Open Full Cap Table & Pitch Report
              </Button>
            </Card>
          ) : (
            <>
              {/* Groww-Inspired Order Execution Ticket */}
              <Card className="glass-panel-premium p-5 sm:p-7 border-white/15 sticky top-24 shadow-2xl">
                {/* BUY / SELL Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/40 border border-white/10 mb-6">
                  <button
                    type="button"
                    onClick={() => setTradeSide("BUY")}
                    className={`py-2.5 rounded-xl font-mono text-xs font-black transition-all ${
                      tradeSide === "BUY"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-lg shadow-emerald-500/25"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    BUY SHARES
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeSide("SELL")}
                    className={`py-2.5 rounded-xl font-mono text-xs font-black transition-all ${
                      tradeSide === "SELL"
                        ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    SELL SHARES
                  </button>
                </div>

            {/* Order Type Toggle: Market vs Limit */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono text-zinc-400 uppercase font-semibold">Order Type</span>
              <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setOrderType("MARKET")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    orderType === "MARKET" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Market
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderType("LIMIT");
                    if (!limitPrice || limitPrice === 100) setLimitPrice(currentPrice);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    orderType === "LIMIT" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Limit
                </button>
              </div>
            </div>

            {/* Available Stocks Announcement for Buyer */}
            {tradeSide === "BUY" && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 mb-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-zinc-300 font-semibold">Company Available Stocks:</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-black text-emerald-400">
                    {(startup.availableShares ?? startup.totalShares ?? 1000000).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">
                    of {(startup.totalShares || 1000000).toLocaleString("en-IN")} authorized
                  </span>
                </div>
              </div>
            )}

            {/* Shares Quantity Input */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <label className="text-zinc-400 uppercase font-semibold">Quantity (Shares)</label>
                <span className="text-zinc-400 text-[11px]">
                  {tradeSide === "BUY"
                    ? `Avail to buy: ${(startup.availableShares ?? startup.totalShares ?? 1000000).toLocaleString("en-IN")} shares`
                    : `Owned: ${sharesOwned} shares`}
                </span>
              </div>
              <Input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="font-mono text-lg font-black h-12 bg-white/5 border-white/10 text-white"
              />

              {/* Quick Add Pills */}
              <div className="flex items-center gap-1.5 pt-1">
                {[10, 50, 100, 500].map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setQuantity((prev) => prev + pill)}
                    className="flex-1 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-mono text-zinc-300 transition-colors"
                  >
                    +{pill}
                  </button>
                ))}
                {tradeSide === "SELL" && sharesOwned > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuantity(sharesOwned)}
                    className="flex-1 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[11px] font-mono text-rose-300 font-bold"
                  >
                    Max
                  </button>
                )}
              </div>
            </div>

            {/* Limit Price Input (Only for Limit orders) */}
            {orderType === "LIMIT" && (
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-xs font-mono">
                  <label className="text-zinc-400 uppercase font-semibold">Limit Price (₹)</label>
                  <span className="text-zinc-400 text-[11px]">LTP: {formatSharePrice(currentPrice)}</span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  className="font-mono text-lg font-black h-12 bg-white/5 border-white/10 text-white"
                />
              </div>
            )}

            {/* Order Summary Box */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2 mb-6 font-mono text-xs">
              <div className="flex justify-between items-center text-zinc-400">
                <span>Execution Price:</span>
                <span className="text-white font-bold">
                  {orderType === "LIMIT" ? formatSharePrice(limitPrice) : `${formatSharePrice(currentPrice)} (Market)`}
                </span>
              </div>
              {tradeSide === "BUY" && (
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Company Available:</span>
                  <span className="text-emerald-400 font-bold">
                    {(startup.availableShares ?? startup.totalShares ?? 1000000).toLocaleString("en-IN")} shares
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-zinc-400">
                <span>{tradeSide === "BUY" ? "Total Payable:" : "Estimated Value:"}</span>
                <span className="text-white font-black text-sm">{formatINR(estimatedTotal)}</span>
              </div>
              {tradeSide === "SELL" && userHolding && (
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-zinc-400">Est. Realized P&L:</span>
                  <span
                    className={`font-black ${
                      estimatedSellPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {estimatedSellPnL >= 0 ? "+" : ""}
                    {formatINR(estimatedSellPnL)}
                  </span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            {!isOpen ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs font-mono text-amber-300">
                Trading is currently locked (Status: {startup.ipoStatus})
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  if (!user) {
                    router.push("/");
                    return;
                  }
                  setConfirmModalOpen(true);
                }}
                disabled={
                  (tradeSide === "BUY" && estimatedTotal > userCash) ||
                  (tradeSide === "SELL" && quantity > sharesOwned) ||
                  quantity <= 0
                }
                className={`w-full h-12 rounded-2xl font-mono text-sm font-black transition-all shadow-xl ${
                  tradeSide === "BUY"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-emerald-500/20"
                    : "bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-400 hover:to-rose-500 shadow-rose-500/20"
                }`}
              >
                {tradeSide === "BUY"
                  ? estimatedTotal > userCash
                    ? "INSUFFICIENT FUNDS"
                    : `CONFIRM BUY (${quantity} SHARES)`
                  : quantity > sharesOwned
                  ? "INSUFFICIENT SHARES"
                  : `CONFIRM SELL (${quantity} SHARES)`}
              </Button>
            )}
          </Card>

          {/* User's Position / Holding on this Stock */}
          <Card className="glass-panel-premium p-5 sm:p-7 border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Your Position in {startup.name}</h3>
            </div>

            {userHolding && userHolding.quantity > 0 ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <span className="block text-[10px] text-zinc-400 uppercase">Shares Owned</span>
                    <span className="text-base font-black text-white">{userHolding.quantity}</span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <span className="block text-[10px] text-zinc-400 uppercase">Avg Buy Price</span>
                    <span className="text-base font-black text-cyan-300">
                      {formatSharePrice(userHolding.averageBuyPrice)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <span className="block text-[10px] text-zinc-400 uppercase">Invested Value</span>
                    <span className="text-base font-black text-white">
                      {formatINR(userHolding.investedValue)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <span className="block text-[10px] text-zinc-400 uppercase">Current Value</span>
                    <span className="text-base font-black text-white">
                      {formatINR(userHolding.currentValue)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex justify-between items-center">
                  <span className="text-zinc-400">Unrealized P&L:</span>
                  <span
                    className={`font-black text-sm ${
                      userHolding.unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {userHolding.unrealizedPnL >= 0 ? "+" : ""}
                    {formatINR(userHolding.unrealizedPnL)} ({userHolding.unrealizedReturnPct >= 0 ? "+" : ""}
                    {userHolding.unrealizedReturnPct.toFixed(2)}%)
                  </span>
                </div>

                {userHolding.realizedPnL !== 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex justify-between items-center">
                    <span className="text-zinc-400">Realized P&L (Booked):</span>
                    <span
                      className={`font-black text-sm ${
                        userHolding.realizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {userHolding.realizedPnL >= 0 ? "+" : ""}
                      {formatINR(userHolding.realizedPnL)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center space-y-2 font-mono text-xs text-zinc-500 border border-white/5 rounded-2xl bg-white/[0.02]">
                <p>You do not currently hold any shares of {startup.name}.</p>
                <p className="text-zinc-400">Use the trade ticket above to take a position!</p>
              </div>
            )}
          </Card>
          </>
        )}
        </div>
      </div>

      {/* Confirmation & Order Execution Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-md bg-[#0c111e]/95 border-white/15 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              Confirm {tradeSide} Order: {startup.name}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-mono text-xs">
              Review transaction terms before sending to the virtual matching engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 font-mono text-xs my-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Action:</span>
                <span className={`font-bold ${tradeSide === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>
                  {tradeSide} ({orderType})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Quantity:</span>
                <span className="text-white font-bold">{quantity} Shares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Price per Share:</span>
                <span className="text-white font-bold">{formatSharePrice(effectivePrice)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-sm">
                <span className="text-zinc-300 font-semibold">Total Value:</span>
                <span className="text-white font-black">{formatINR(estimatedTotal)}</span>
              </div>
            </div>

            {tradeFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 ${
                  tradeFeedback.success
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                }`}
              >
                {tradeFeedback.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{tradeFeedback.message}</span>
              </motion.div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setConfirmModalOpen(false)}
              className="border-white/10 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className={`font-mono font-bold ${
                tradeSide === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                  : "bg-rose-500 hover:bg-rose-400 text-white"
              }`}
            >
              {isSubmitting ? "Executing Trade..." : `Execute ${tradeSide}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {startup && (
        <TeamReportModal
          startupSlug={startup.slug}
          startupName={startup.name}
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
        />
      )}
    </div>
  );
}
