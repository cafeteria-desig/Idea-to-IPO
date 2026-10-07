"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { useAuth } from "@/context/AuthContext";
import {
  formatINR,
  formatSharePrice,
  formatPriceChange,
  getSubscriptionStatus,
} from "@/lib/formatters";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { TeamRealtimeGraph } from "@/components/TeamRealtimeGraph";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Users,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Zap,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import type { StartupItem, HoldingItem } from "@/types";

export default function TeamsPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Trade Modal State
  const [selectedStartup, setSelectedStartup] = useState<StartupItem | null>(null);
  const [tradeSide, setTradeSide] = useState<"BUY" | "SELL">("BUY");
  const [tradeQuantity, setTradeQuantity] = useState<number>(50);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeStatus, setTradeStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [userHoldings, setUserHoldings] = useState<HoldingItem[]>([]);

  const cacheRef = React.useRef<string>("");

  const fetchStartups = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/startups", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text !== cacheRef.current) {
          cacheRef.current = text;
          setStartups(JSON.parse(text));
        }
      }
    } catch (err) {
      console.error("Failed to load startups:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserHoldings = useCallback(async () => {
    if (!user?.id) {
      setUserHoldings([]);
      return;
    }
    try {
      const res = await fetch(`/api/trade/holdings?userId=${user.id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.holdings)) {
          setUserHoldings(json.holdings);
        }
      }
    } catch (err) {
      console.error("Failed to load user holdings:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStartups();
    if (user?.id) {
      fetchUserHoldings();
    }
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchStartups();
      if (user?.id) {
        fetchUserHoldings();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchStartups, fetchUserHoldings, user?.id]);

  const handleOpenTradeModal = (startup: StartupItem, side: "BUY" | "SELL" = "BUY") => {
    if (!user) {
      router.push("/");
      return;
    }
    if (user?.id) {
      fetchUserHoldings();
    }
    setSelectedStartup(startup);
    setTradeSide(side);
    const existingHolding = userHoldings.find((h) => h.startupId === startup.id);
    const owned = existingHolding?.quantity || 0;
    if (side === "SELL") {
      setTradeQuantity(owned > 0 ? Math.min(50, owned) : 0);
    } else {
      setTradeQuantity(50);
    }
    setTradeStatus(null);
  };

  const executeTrade = async () => {
    if (!selectedStartup || !user) return;
    setIsTrading(true);
    setTradeStatus(null);

    try {
      const res = await fetch("/api/trade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          startupId: selectedStartup.id,
          side: tradeSide,
          type: "MARKET",
          quantity: Number(tradeQuantity),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: tradeSide === "BUY" ? ["#00e599", "#00c8ff", "#ffffff"] : ["#ef4444", "#f59e0b", "#ffffff"],
        });

        setTradeStatus({
          success: true,
          message: data.message || `Trade confirmed!`,
        });

        await refreshUser();
        await fetchStartups();
        await fetchUserHoldings();

        setTimeout(() => {
          setSelectedStartup(null);
          setTradeStatus(null);
        }, 1900);
      } else {
        setTradeStatus({
          success: false,
          message: data.message || "Failed to execute order.",
        });
      }
    } catch (err) {
      setTradeStatus({
        success: false,
        message: "Network error while submitting trade.",
      });
    } finally {
      setIsTrading(false);
    }
  };

  const userCash = user?.currentBalance || 0;
  const currentHolding = userHoldings.find((h) => h.startupId === selectedStartup?.id);
  const sharesOwned = currentHolding ? currentHolding.quantity : 0;
  const effectivePrice = selectedStartup?.currentPrice || 100;
  const estimatedAmount = Math.round(tradeQuantity * effectivePrice);
  const maxAffordableShares = Math.floor(userCash / (effectivePrice || 1));

  return (
    <div className="space-y-6 sm:space-y-10 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4 sm:pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Live Venture Stocks
          </h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Browse listed startup companies, inspect real-time valuations, and buy or sell shares.
          </p>
        </div>

        {user && user.role !== "ADMIN" && user.role !== "STARTUP" && (
          <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent p-3 sm:p-4 px-4 sm:px-5 backdrop-blur-2xl shadow-[0_0_20px_rgba(0,229,153,0.1)]">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                Available Liquidity
              </span>
              <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
                {formatINR(user.currentBalance)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Startups Grid */}
      {loading && startups.length === 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-8 lg:gap-10">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 sm:h-96 rounded-3xl border border-white/10 bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : startups.length === 0 ? (
        <div className="text-center py-20 px-6 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
          <Layers className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Pitch Teams Registered Yet</h3>
          <p className="text-sm font-mono text-zinc-400 max-w-md mx-auto">
            Venture pitches will appear here immediately once registered by the Event Director in the Admin Control Room.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-8 lg:gap-10">
          {startups.map((startup, index) => {
            const sub = getSubscriptionStatus(startup.totalInvestmentReceived, startup.fundingAsk);
            const isOpen = startup.ipoStatus === "IPO_OPEN" && !startup.isSuspended;
            const openP = startup.openPrice || startup.initialPrice || 100;
            const chg = startup.priceChange ?? Number((startup.currentPrice - openP).toFixed(2));
            const pct = startup.percentageChange ?? Number((((startup.currentPrice - openP) / openP) * 100).toFixed(2));
            const stat = formatPriceChange(chg, pct);
            const isPos = chg >= 0;
            const startupHolding = userHoldings.find((h) => h.startupId === startup.id);
            const ownedSharesCount = startupHolding ? startupHolding.quantity : 0;

            return (
              <motion.div
                key={startup.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -6, transition: { duration: 0.25 } }}
                className="h-full"
              >
                <Card
                  className={`relative h-full flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-b from-[#0e1424]/90 via-[#0a0f1c]/90 to-[#060911]/90 backdrop-blur-2xl shadow-xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-glass-card-hover group ${
                    isOpen ? "ring-1 ring-emerald-500/40 shadow-[0_0_30px_rgba(0,229,153,0.08)]" : ""
                  }`}
                >
                  {/* Glow accent line for open IPO */}
                  {isOpen && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 shadow-[0_0_15px_rgba(0,229,153,0.8)]" />
                  )}

                  <CardHeader className="p-6 sm:p-8 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono font-bold text-zinc-300">
                            Pitch #{startup.pitchOrder}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                            {startup.industry}
                          </span>
                          {ownedSharesCount > 0 && (
                            <span className="rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-300 shadow-sm">
                              Stock Available: {ownedSharesCount.toLocaleString("en-IN")}
                            </span>
                          )}
                          <StatusBadge status={startup.ipoStatus} />
                        </div>
                        <CardTitle className="text-2xl sm:text-3xl font-black text-white group-hover:text-cyan-300 transition-colors">
                          <Link href={`/startup/${startup.slug}`} prefetch={true}>{startup.name}</Link>
                        </CardTitle>
                      </div>

                      {/* Stock Price Display */}
                      <div className="text-right">
                        <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                          LTP
                        </span>
                        <span className="text-2xl sm:text-3xl font-mono font-black text-white">
                          {formatSharePrice(startup.currentPrice)}
                        </span>
                        <span className={`inline-block text-[11px] font-mono font-bold mt-0.5 ${stat.textClass}`}>
                          {isPos ? "+" : ""}
                          {stat.text}
                        </span>
                      </div>
                    </div>
                    <CardDescription className="text-xs sm:text-sm text-zinc-300 line-clamp-2 mt-2 leading-relaxed">
                      {startup.tagLine}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-6 sm:p-8 pt-0 space-y-4">
                    {/* Financial Metrics Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-2xl border border-white/10 bg-[#060911]/60 p-3 text-xs font-mono">
                      <div>
                        <span className="block text-[10px] text-zinc-400 uppercase">24h High</span>
                        <span className="font-bold text-emerald-400">{formatSharePrice(startup.dayHigh || startup.currentPrice)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-400 uppercase">24h Low</span>
                        <span className="font-bold text-rose-400">{formatSharePrice(startup.dayLow || startup.currentPrice)}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-400 uppercase">Volume</span>
                        <span className="font-bold text-cyan-300">{startup.totalVolume?.toLocaleString("en-IN") || 0}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-zinc-400 uppercase">Market Cap</span>
                        <span className="font-bold text-amber-300">{formatINR((startup.totalShares || 1000000) * startup.currentPrice)}</span>
                      </div>
                    </div>

                    {/* Mini Valuation trajectory sparkline */}
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 mb-1">
                        <span>Capital Raised: <strong className="text-white">{formatINR(startup.totalInvestmentReceived)}</strong></span>
                        <span className="text-emerald-400 font-bold">{sub.label}</span>
                      </div>
                      <TeamRealtimeGraph
                        currentTotal={startup.totalInvestmentReceived}
                        fundingAsk={startup.fundingAsk}
                        height={55}
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="p-6 sm:p-8 pt-0 flex items-center gap-2 border-t border-white/[0.06] mt-auto">
                    <Button
                      size="sm"
                      disabled={!isOpen}
                      onClick={() => handleOpenTradeModal(startup, "BUY")}
                      className={`flex-1 h-11 px-5 rounded-xl font-mono text-xs font-bold transition-all ${
                        isOpen
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-md shadow-emerald-500/20"
                          : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                      }`}
                    >
                      {isOpen ? "Quick Buy" : "Market Closed"}
                    </Button>
                    {isOpen && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenTradeModal(startup, "SELL")}
                        className="flex-1 h-11 px-4 rounded-xl font-mono text-xs font-bold border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                      >
                        {ownedSharesCount > 0 ? `Quick Sell (${ownedSharesCount})` : "Quick Sell"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Quick Trade Modal */}
      <Dialog open={!!selectedStartup} onOpenChange={(open) => !open && setSelectedStartup(null)}>
        <DialogContent className="max-w-md bg-[#0c111e]/95 border-white/15 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span>Trade: {selectedStartup?.name}</span>
              <span className="text-sm font-mono text-emerald-400 font-black">
                {formatSharePrice(selectedStartup?.currentPrice || 100)}
              </span>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-mono text-xs">
              Execute a simulated virtual trade directly against the matching engine.
            </DialogDescription>
          </DialogHeader>

          {selectedStartup && (
            <div className="space-y-4 font-mono text-xs my-2">
              {/* Buy / Sell selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/40 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setTradeSide("BUY");
                    if (tradeQuantity <= 0) setTradeQuantity(50);
                  }}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    tradeSide === "BUY"
                      ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/25"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeSide("SELL");
                    if (sharesOwned > 0 && (tradeQuantity > sharesOwned || tradeQuantity <= 0)) {
                      setTradeQuantity(Math.min(50, sharesOwned));
                    }
                  }}
                  className={`py-2 rounded-xl font-bold transition-all ${
                    tradeSide === "SELL"
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  SELL
                </button>
              </div>

              {/* Stock Available & Market Details */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs">
                <div>
                  <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                    Stock Available
                  </span>
                  <span className={`text-sm font-mono font-black ${sharesOwned > 0 ? "text-emerald-400" : "text-zinc-400"}`}>
                    {sharesOwned.toLocaleString("en-IN")} {sharesOwned === 1 ? "Share" : "Shares"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                    {tradeSide === "BUY" ? "Available Cash" : "Avg Buy Price"}
                  </span>
                  <span className="text-sm font-mono font-black text-cyan-300">
                    {tradeSide === "BUY"
                      ? formatINR(userCash)
                      : currentHolding?.averageBuyPrice
                      ? formatSharePrice(currentHolding.averageBuyPrice)
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-zinc-400 uppercase font-semibold">Shares Quantity</label>
                  <span className="text-zinc-400 text-[11px]">
                    {tradeSide === "BUY" ? (
                      <>
                        Cash: <strong className="text-emerald-400 font-bold">{formatINR(userCash)}</strong>
                      </>
                    ) : (
                      <>
                        Stock Available:{" "}
                        <strong className={sharesOwned > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          {sharesOwned} {sharesOwned === 1 ? "share" : "shares"}
                        </strong>
                      </>
                    )}
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={tradeSide === "SELL" ? sharesOwned : undefined}
                  value={tradeQuantity || ""}
                  onChange={(e) => setTradeQuantity(parseInt(e.target.value) || 0)}
                  className="font-mono text-base font-bold bg-white/5 border-white/10 text-white"
                />

                {/* Quick pills */}
                <div className="flex gap-1.5 pt-1">
                  {[10, 50, 100, 250].map((pill) => (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => setTradeQuantity(pill)}
                      className={`flex-1 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                        tradeQuantity === pill
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-bold"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {pill}
                    </button>
                  ))}
                  {tradeSide === "SELL" && sharesOwned > 0 && (
                    <button
                      type="button"
                      onClick={() => setTradeQuantity(sharesOwned)}
                      className={`px-3 py-1 rounded-lg border text-[11px] font-mono font-bold transition-colors ${
                        tradeQuantity === sharesOwned
                          ? "border-rose-500/50 bg-rose-500/25 text-rose-300 font-black"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                      }`}
                    >
                      Max ({sharesOwned})
                    </button>
                  )}
                  {tradeSide === "BUY" && maxAffordableShares > 0 && (
                    <button
                      type="button"
                      onClick={() => setTradeQuantity(maxAffordableShares)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-colors ${
                        tradeQuantity === maxAffordableShares
                          ? "border-emerald-500/50 bg-emerald-500/25 text-emerald-300 font-black"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              {/* Status messages for user guidance */}
              {tradeSide === "SELL" && sharesOwned === 0 && (
                <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>You have 0 shares of {selectedStartup.name} available to sell.</span>
                </div>
              )}
              {tradeSide === "SELL" && sharesOwned > 0 && tradeQuantity > sharesOwned && (
                <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Quantity exceeds your available stock ({sharesOwned} shares).</span>
                </div>
              )}
              {tradeSide === "BUY" && estimatedAmount > userCash && (
                <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Required amount ({formatINR(estimatedAmount)}) exceeds available cash ({formatINR(userCash)}).</span>
                </div>
              )}

              {/* Estimated Total Box */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Price per Share:</span>
                  <span className="text-white font-bold">{formatSharePrice(effectivePrice)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 text-sm">
                  <span className="text-zinc-300 font-semibold">Estimated Amount:</span>
                  <span className="text-white font-black">{formatINR(estimatedAmount)}</span>
                </div>
              </div>

              {tradeStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 ${
                    tradeStatus.success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {tradeStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{tradeStatus.message}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isTrading}
              onClick={() => setSelectedStartup(null)}
              className="border-white/10 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={executeTrade}
              disabled={
                isTrading ||
                tradeQuantity <= 0 ||
                (tradeSide === "BUY" && estimatedAmount > userCash) ||
                (tradeSide === "SELL" && (sharesOwned <= 0 || tradeQuantity > sharesOwned))
              }
              className={`font-mono font-bold ${
                tradeSide === "BUY"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                  : "bg-rose-500 hover:bg-rose-400 text-white"
              }`}
            >
              {isTrading
                ? "Executing..."
                : tradeSide === "SELL" && sharesOwned <= 0
                ? "No Stock Available"
                : tradeSide === "SELL" && tradeQuantity > sharesOwned
                ? "Exceeds Stock Available"
                : tradeSide === "BUY" && estimatedAmount > userCash
                ? "Insufficient Cash"
                : `Confirm ${tradeSide}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
