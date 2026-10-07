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
  formatDate,
} from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Clock,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PortfolioResponse, HoldingItem, OrderItem } from "@/types";

export default function PortfolioPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Sell Modal State
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<HoldingItem | null>(null);
  const [sellQty, setSellQty] = useState<number>(1);
  const [sellOrderType, setSellOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [sellLimitPrice, setSellLimitPrice] = useState<number>(100);
  const [isSelling, setIsSelling] = useState(false);
  const [sellFeedback, setSellFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Order Cancellation State
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  const cacheRef = React.useRef<string>("");

  const fetchPortfolio = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text !== cacheRef.current) {
          cacheRef.current = text;
          setData(JSON.parse(text));
        }
      }
    } catch (err) {
      console.error("Failed to fetch portfolio:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 3500);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Wallet className="h-12 w-12 text-zinc-500" />
        <h2 className="text-xl font-bold text-white">Authentication Required</h2>
        <p className="text-sm text-zinc-400 max-w-sm">
          Sign in using your account to review your portfolio holdings.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-mono font-bold text-black hover:bg-emerald-400"
        >
          Go to Portal Login
        </Link>
      </div>
    );
  }

  const summary = data?.summary || {
    totalPortfolioValue: user.currentBalance + user.totalInvested,
    availableCash: user.currentBalance,
    investedValue: user.totalInvested,
    currentValue: user.totalInvested,
    unrealizedPnL: 0,
    realizedPnL: 0,
    totalPnL: 0,
    totalReturnPct: 0,
    holdingsCount: 0,
  };

  const holdings = data?.holdings || [];
  const openOrders = data?.openOrders || [];
  const recentOrders = data?.recentOrders || [];
  const recentTrades = data?.recentTrades || [];

  // Open Quick Sell Dialog
  const handleOpenSellModal = (holding: HoldingItem) => {
    setSelectedHolding(holding);
    setSellQty(holding.quantity);
    setSellLimitPrice(holding.currentPrice);
    setSellOrderType("MARKET");
    setSellFeedback(null);
    setSellModalOpen(true);
  };

  // Submit Sell Order
  const handleExecuteSell = async () => {
    if (!selectedHolding || !user) return;
    setIsSelling(true);
    setSellFeedback(null);

    try {
      const res = await fetch("/api/trade/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          startupId: selectedHolding.startupId,
          side: "SELL",
          type: sellOrderType,
          quantity: Number(sellQty),
          price: sellOrderType === "LIMIT" ? Number(sellLimitPrice) : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        confetti({
          particleCount: 120,
          spread: 70,
          colors: ["#ef4444", "#f59e0b", "#ffffff"],
        });

        setSellFeedback({
          success: true,
          message: json.message || `Sold ${sellQty} shares successfully!`,
        });

        await refreshUser();
        await fetchPortfolio();

        setTimeout(() => {
          setSellModalOpen(false);
          setSellFeedback(null);
        }, 2000);
      } else {
        setSellFeedback({
          success: false,
          message: json.message || "Failed to execute sell order.",
        });
      }
    } catch (err) {
      setSellFeedback({
        success: false,
        message: "Network error while submitting sell order.",
      });
    } finally {
      setIsSelling(false);
    }
  };

  // Cancel Open Order
  const handleCancelOrder = async (orderId: string) => {
    if (!user) return;
    setCancellingOrderId(orderId);
    try {
      const res = await fetch(`/api/trade/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCancelFeedback(`Order ${orderId} cancelled successfully.`);
        await refreshUser();
        await fetchPortfolio();
        setTimeout(() => setCancelFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Cancel order error:", err);
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Pie chart data
  const PIE_COLORS = ["#00e599", "#00c8ff", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
  const pieData = holdings
    .filter((h) => h.currentValue > 0)
    .map((h) => ({
      name: h.startupName,
      value: h.currentValue,
    }));

  const isTotalPnLPositive = summary.totalPnL >= 0;

  return (
    <div className="space-y-6 sm:space-y-10 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4 sm:pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Portfolio & Holdings
          </h1>
        </div>

        {/* Total Portfolio Value Badge */}
        <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent p-3 sm:p-4 px-4 sm:px-6 backdrop-blur-2xl shadow-[0_0_25px_rgba(0,229,153,0.12)]">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
              Total Portfolio Value
            </span>
            <span className="text-lg sm:text-2xl font-mono font-black text-emerald-400">
              {formatINR(summary.totalPortfolioValue)}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="glass-panel-premium p-4 sm:p-6 border-white/[0.08]">
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
            Available Cash
          </span>
          <span className="text-xl sm:text-3xl font-mono font-black text-white mt-1 sm:mt-2 block">
            {formatINR(summary.availableCash)}
          </span>
          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 mt-1 block">Ready to deploy</span>
        </Card>

        <Card className="glass-panel-premium p-4 sm:p-6 border-white/[0.08]">
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
            Invested Value
          </span>
          <span className="text-xl sm:text-3xl font-mono font-black text-cyan-300 mt-1 sm:mt-2 block">
            {formatINR(summary.investedValue)}
          </span>
          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 mt-1 block">Cost basis of holdings</span>
        </Card>

        <Card className="glass-panel-premium p-4 sm:p-6 border-white/[0.08]">
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
            Current Market Value
          </span>
          <span className="text-xl sm:text-3xl font-mono font-black text-white mt-1 sm:mt-2 block">
            {formatINR(summary.currentValue)}
          </span>
          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 mt-1 block">
            {summary.holdingsCount} Active positions
          </span>
        </Card>

        <Card
          className={`glass-panel-premium p-4 sm:p-6 ${
            isTotalPnLPositive
              ? "border-emerald-500/30 bg-emerald-500/[0.04]"
              : "border-rose-500/30 bg-rose-500/[0.04]"
          }`}
        >
          <span
            className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold block ${
              isTotalPnLPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            Total P&L / Returns
          </span>
          <span
            className={`text-xl sm:text-3xl font-mono font-black mt-1 sm:mt-2 block ${
              isTotalPnLPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isTotalPnLPositive ? "+" : ""}
            {formatINR(summary.totalPnL)}
          </span>
          <span
            className={`text-[10px] sm:text-xs font-mono mt-1 block font-bold ${
              isTotalPnLPositive ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {isTotalPnLPositive ? "+" : ""}
            {summary.totalReturnPct.toFixed(2)}% Overall Return
          </span>
        </Card>
      </div>

      {/* Cancel Feedback Banner */}
      {cancelFeedback && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold">
          {cancelFeedback}
        </div>
      )}

      {/* Main Tabbed Cockpit */}
      <Tabs defaultValue="holdings" className="w-full space-y-6">
        <TabsList className="bg-[#0c111e]/90 border border-white/10 p-1 rounded-2xl">
          <TabsTrigger value="holdings" className="rounded-xl font-mono text-xs font-bold">
            Holdings ({holdings.length})
          </TabsTrigger>
          <TabsTrigger value="open-orders" className="rounded-xl font-mono text-xs font-bold">
            Open Orders ({openOrders.length})
          </TabsTrigger>
          <TabsTrigger value="order-history" className="rounded-xl font-mono text-xs font-bold">
            Order History ({recentOrders.length})
          </TabsTrigger>
          <TabsTrigger value="trades" className="rounded-xl font-mono text-xs font-bold">
            Trades ({recentTrades.length})
          </TabsTrigger>
          <TabsTrigger value="allocation" className="rounded-xl font-mono text-xs font-bold">
            Allocation
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: HOLDINGS */}
        <TabsContent value="holdings" className="space-y-4">
          {holdings.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-3xl border border-white/10 bg-[#060911]/80 backdrop-blur-2xl overflow-hidden shadow-xl">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead>Company / Stock</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>Avg Buy Price</TableHead>
                      <TableHead>LTP (Current)</TableHead>
                      <TableHead>Invested</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>P&L (Return %)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((h) => {
                      const isPnLPos = h.totalPnL >= 0;
                      return (
                        <TableRow key={h.startupId} className="border-white/5 hover:bg-white/[0.02]">
                          <TableCell className="font-bold text-white">
                            <Link
                              href={`/startup/${h.slug}`}
                              prefetch={true}
                              className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
                            >
                              <span>{h.startupName}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono font-black text-white">{h.quantity}</TableCell>
                          <TableCell className="font-mono text-zinc-300">
                            {formatSharePrice(h.averageBuyPrice)}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-white">
                            {formatSharePrice(h.currentPrice)}
                          </TableCell>
                          <TableCell className="font-mono text-zinc-300">{formatINR(h.investedValue)}</TableCell>
                          <TableCell className="font-mono font-bold text-white">
                            {formatINR(h.currentValue)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`font-mono font-black text-xs ${
                                isPnLPos ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isPnLPos ? "+" : ""}
                              {formatINR(h.totalPnL)} ({isPnLPos ? "+" : ""}
                              {h.unrealizedReturnPct.toFixed(2)}%)
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/startup/${h.slug}`}
                                prefetch={true}
                                className="inline-flex items-center justify-center h-8 px-3 rounded-lg font-mono text-xs border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              >
                                Buy More
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSellModal(h)}
                                className="h-8 px-3 rounded-lg font-mono text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                              >
                                Sell
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {holdings.map((h) => {
                  const isPnLPos = h.totalPnL >= 0;
                  return (
                    <Card key={h.startupId} className="glass-panel-premium p-4 border-white/10 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <Link href={`/startup/${h.slug}`} prefetch={true} className="font-bold text-white text-base">
                            {h.startupName}
                          </Link>
                          <span className="block text-xs font-mono text-zinc-400 mt-0.5">
                            {h.quantity} shares @ {formatSharePrice(h.averageBuyPrice)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-white text-sm">
                            {formatSharePrice(h.currentPrice)}
                          </span>
                          <span
                            className={`block text-xs font-mono font-bold mt-0.5 ${
                              isPnLPos ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPnLPos ? "+" : ""}
                            {formatINR(h.totalPnL)} ({h.unrealizedReturnPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs font-mono text-zinc-400 pt-2 border-t border-white/5">
                        <span>Current Value: {formatINR(h.currentValue)}</span>
                        <span>Invested: {formatINR(h.investedValue)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Link
                          href={`/startup/${h.slug}`}
                          prefetch={true}
                          className="inline-flex items-center justify-center h-9 rounded-xl font-mono text-xs border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          Buy More
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSellModal(h)}
                          className="h-9 rounded-xl font-mono text-xs border-rose-500/30 text-rose-400"
                        >
                          Sell Shares
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="glass-panel-premium p-12 text-center space-y-3 border-white/10">
              <Layers className="h-10 w-10 text-zinc-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Holdings Found</h3>
              <p className="text-xs font-mono text-zinc-400 max-w-sm mx-auto">
                You do not currently own shares in any startup. Visit the Live Market to place your first trade!
              </p>
              <Button
                onClick={() => router.push("/teams")}
                className="rounded-xl bg-emerald-500 text-black font-mono font-bold text-xs hover:bg-emerald-400"
              >
                Browse Tradable Stocks
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: OPEN ORDERS */}
        <TabsContent value="open-orders">
          {openOrders.length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#060911]/80 backdrop-blur-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Limit Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Placed At</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOrders.map((ord) => (
                    <TableRow key={ord.id}>
                      <TableCell className="font-mono text-xs font-bold text-cyan-400">{ord.id}</TableCell>
                      <TableCell className="font-bold text-white">{ord.startupName}</TableCell>
                      <TableCell>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                            ord.side === "BUY"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {ord.side}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{ord.type}</TableCell>
                      <TableCell className="font-mono font-bold text-white">
                        {formatSharePrice(ord.price)}
                      </TableCell>
                      <TableCell className="font-mono text-zinc-300">
                        {ord.filledQuantity} / {ord.quantity}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded">
                          {ord.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{formatDate(ord.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cancellingOrderId === ord.id}
                          onClick={() => handleCancelOrder(ord.id)}
                          className="h-8 px-3 rounded-lg font-mono text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                        >
                          {cancellingOrderId === ord.id ? "Cancelling..." : "Cancel"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card className="glass-panel-premium p-10 text-center text-xs font-mono text-zinc-500 border-white/10">
              No open orders currently pending in the order book.
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: ORDER HISTORY */}
        <TabsContent value="order-history">
          {recentOrders.length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#060911]/80 backdrop-blur-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order Price</TableHead>
                    <TableHead>Quantity Filled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((ord) => (
                    <TableRow key={ord.id}>
                      <TableCell className="font-mono text-xs font-bold text-cyan-400">{ord.id}</TableCell>
                      <TableCell className="font-bold text-white">{ord.startupName}</TableCell>
                      <TableCell>
                        <span
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                            ord.side === "BUY"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {ord.side}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{ord.type}</TableCell>
                      <TableCell className="font-mono text-white">{formatSharePrice(ord.price)}</TableCell>
                      <TableCell className="font-mono text-zinc-300">
                        {ord.filledQuantity} / {ord.quantity}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                            ord.status === "FILLED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : ord.status === "CANCELLED"
                              ? "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {ord.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{formatDate(ord.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card className="glass-panel-premium p-10 text-center text-xs font-mono text-zinc-500 border-white/10">
              No past order history found.
            </Card>
          )}
        </TabsContent>

        {/* TAB 4: TRADES */}
        <TabsContent value="trades">
          {recentTrades.length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#060911]/80 backdrop-blur-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trade ID</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Execution Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrades.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs font-bold text-cyan-400">{t.id}</TableCell>
                      <TableCell className="font-bold text-white">{t.startupName}</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-400">
                        {formatSharePrice(t.price)}
                      </TableCell>
                      <TableCell className="font-mono text-white">{t.quantity} shares</TableCell>
                      <TableCell className="font-mono font-black text-white">{formatINR(t.amount)}</TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">{formatDate(t.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card className="glass-panel-premium p-10 text-center text-xs font-mono text-zinc-500 border-white/10">
              No executed trades recorded yet.
            </Card>
          )}
        </TabsContent>

        {/* TAB 5: ASSET ALLOCATION */}
        <TabsContent value="allocation">
          <Card className="glass-panel-premium p-6 sm:p-8 border-white/10">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-cyan-400" /> Portfolio Exposure by Company
            </h3>

            {pieData.length > 0 ? (
              <div className="h-80 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={55}
                      paddingAngle={4}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0];
                          return (
                            <div className="rounded-xl border border-white/10 bg-[#0c111e]/95 p-3 font-mono text-xs shadow-2xl backdrop-blur-xl">
                              <span className="text-white font-bold block">{p.name}</span>
                              <span className="text-emerald-400 font-bold text-sm block mt-1">
                                {formatINR(Number(p.value))}
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
            ) : (
              <div className="py-12 text-center font-mono text-xs text-zinc-500">
                No active asset holdings to display in allocation chart.
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Sell Modal */}
      <Dialog open={sellModalOpen} onOpenChange={setSellModalOpen}>
        <DialogContent className="max-w-md bg-[#0c111e]/95 border-white/15 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-rose-400 flex items-center gap-2">
              Sell Shares: {selectedHolding?.startupName}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-mono text-xs">
              Execute a sell order against the live order book or place an ask quote.
            </DialogDescription>
          </DialogHeader>

          {selectedHolding && (
            <div className="space-y-4 font-mono text-xs my-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Available to Sell:</span>
                  <span className="text-white font-bold">{selectedHolding.quantity} Shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Current Market Price:</span>
                  <span className="text-white font-bold">{formatSharePrice(selectedHolding.currentPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Your Avg Buy Price:</span>
                  <span className="text-cyan-300 font-bold">{formatSharePrice(selectedHolding.averageBuyPrice)}</span>
                </div>
              </div>

              {/* Order Type */}
              <div className="flex items-center justify-between">
                <label className="text-zinc-400 uppercase font-semibold">Order Type</label>
                <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => setSellOrderType("MARKET")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      sellOrderType === "MARKET" ? "bg-white/15 text-white" : "text-zinc-400"
                    }`}
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    onClick={() => setSellOrderType("LIMIT")}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      sellOrderType === "LIMIT" ? "bg-white/15 text-white" : "text-zinc-400"
                    }`}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-zinc-400 uppercase font-semibold">Shares to Sell</label>
                  <button
                    type="button"
                    onClick={() => setSellQty(selectedHolding.quantity)}
                    className="text-rose-400 font-bold text-[11px] underline"
                  >
                    Max ({selectedHolding.quantity})
                  </button>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={selectedHolding.quantity}
                  value={sellQty}
                  onChange={(e) =>
                    setSellQty(Math.min(selectedHolding.quantity, Math.max(1, parseInt(e.target.value) || 1)))
                  }
                  className="font-mono text-base font-bold bg-white/5 border-white/10 text-white"
                />
              </div>

              {/* Limit Price */}
              {sellOrderType === "LIMIT" && (
                <div className="space-y-1.5">
                  <label className="text-zinc-400 uppercase font-semibold">Limit Price (₹)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={sellLimitPrice}
                    onChange={(e) => setSellLimitPrice(parseFloat(e.target.value) || 0.01)}
                    className="font-mono text-base font-bold bg-white/5 border-white/10 text-white"
                  />
                </div>
              )}

              {/* Projected Value & Realized P&L */}
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300 font-semibold">Gross Proceeds:</span>
                  <span className="text-white font-black">
                    {formatINR(sellQty * (sellOrderType === "LIMIT" ? sellLimitPrice : selectedHolding.currentPrice))}
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-white/10">
                  <span className="text-zinc-400">Projected Realized P&L:</span>
                  <span
                    className={`font-black ${
                      (sellOrderType === "LIMIT" ? sellLimitPrice : selectedHolding.currentPrice) >=
                      selectedHolding.averageBuyPrice
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {formatINR(
                      sellQty *
                        ((sellOrderType === "LIMIT" ? sellLimitPrice : selectedHolding.currentPrice) -
                          selectedHolding.averageBuyPrice)
                    )}
                  </span>
                </div>
              </div>

              {sellFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 ${
                    sellFeedback.success
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  }`}
                >
                  {sellFeedback.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{sellFeedback.message}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={isSelling}
              onClick={() => setSellModalOpen(false)}
              className="border-white/10 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteSell}
              disabled={isSelling || !selectedHolding || sellQty <= 0 || sellQty > (selectedHolding?.quantity || 0)}
              className="bg-rose-500 hover:bg-rose-600 text-white font-mono font-bold"
            >
              {isSelling ? "Executing Sell..." : `Sell ${sellQty} Shares`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
