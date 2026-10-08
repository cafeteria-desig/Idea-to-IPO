"use client";

import React, { useState, useEffect } from "react";
import { formatINR, formatSharePrice, formatPriceChange } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Users,
  PieChart,
  BarChart3,
  Award,
  Layers,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  ExternalLink,
  Coins,
  CheckCircle2,
  ArrowUpRight,
  FileText,
} from "lucide-react";

interface TeamReportModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  startupSlug: string | null;
  startupName?: string;
}

export function TeamReportModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
  startupSlug,
  startupName,
}: TeamReportModalProps) {
  const isModalOpen = open !== undefined ? open : (isOpen ?? false);
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "captable" | "trades" | "pitch">("overview");

  useEffect(() => {
    if (!isModalOpen || !startupSlug) {
      setReportData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/startups/${startupSlug}/report`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setReportData(data);
        }
      })
      .catch((err) => console.error("Report fetch error:", err))
      .finally(() => setLoading(false));
  }, [isModalOpen, startupSlug]);

  if (!isModalOpen) return null;

  const s = reportData?.startup;
  const cb = reportData?.capitalBreakdown;
  const capTable = reportData?.capTable || [];
  const trades = reportData?.recentTrades || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(openVal) => !openVal && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#070b14]/98 border border-white/15 text-white p-4 sm:p-6 rounded-3xl backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <DialogHeader className="border-b border-white/10 pb-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 font-mono text-[11px] font-bold">
                  <Sparkles className="h-3 w-3" /> FOUNDER REPORT SYSTEM
                </span>
                {s?.industry && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-white/10 bg-white/5 text-zinc-400">
                    {s.industry}
                  </span>
                )}
              </div>
              <DialogTitle className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                {s?.name || startupName || "Startup Report"}
                <span className="text-xs font-mono font-normal text-zinc-400">
                  (Pitch #{s?.pitchOrder || 1})
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-zinc-400">
                Official Pitch & Exchange Performance Audit • Live Cap Table & Dilution Tracking
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="font-mono text-xs border-white/20 bg-white/5 hover:bg-white/10 text-zinc-200 gap-1.5"
              >
                <Printer className="h-3.5 w-3.5 text-cyan-400" /> Export / Print
              </Button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 pt-2 overflow-x-auto scrollbar-none">
            {[
              { id: "overview", label: "📊 Performance & Capital" },
              { id: "captable", label: `👥 Cap Table (${capTable.length} Investors)` },
              { id: "trades", label: `📈 Market Trades (${trades.length})` },
              { id: "pitch", label: "📄 Pitch Briefing" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="p-12 text-center font-mono text-xs text-zinc-400 space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
            <p>Compiling live founder audit report & cap table...</p>
          </div>
        ) : !s ? (
          <div className="p-12 text-center font-mono text-xs text-zinc-400">
            Unable to load team report. Please try again.
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* TAB 1: OVERVIEW & PERFORMANCE */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* 4 Executive Metric Tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                  {/* Tile 1: Capital Raised */}
                  <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] space-y-1">
                    <span className="text-[10px] uppercase text-zinc-400 block">Total Capital Raised</span>
                    <strong className="text-xl sm:text-2xl font-black text-emerald-400 block truncate">
                      {formatINR(s.totalRaised)}
                    </strong>
                    <span className="text-[10px] text-zinc-400 block">
                      Target: {formatINR(s.fundingAsk)} ({cb?.subscriptionPercent}% funded)
                    </span>
                  </div>

                  {/* Tile 2: Stock Price */}
                  <div className="p-3.5 rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.05] space-y-1">
                    <span className="text-[10px] uppercase text-zinc-400 block">Share Price (LTP)</span>
                    <strong className="text-xl sm:text-2xl font-black text-white block">
                      {formatSharePrice(s.currentPrice)}
                    </strong>
                    <span className="text-[10px] text-cyan-300 block">
                      Open: {formatSharePrice(s.openPrice)} • H: {formatSharePrice(s.dayHigh)}
                    </span>
                  </div>

                  {/* Tile 3: Market Cap */}
                  <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] space-y-1">
                    <span className="text-[10px] uppercase text-zinc-400 block">Market Valuation</span>
                    <strong className="text-xl sm:text-2xl font-black text-amber-300 block truncate">
                      {formatINR(s.marketCap)}
                    </strong>
                    <span className="text-[10px] text-zinc-400 block">
                      Volume: {s.totalVolume.toLocaleString()} shares
                    </span>
                  </div>

                  {/* Tile 4: Founder Equity */}
                  <div className="p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/[0.05] space-y-1">
                    <span className="text-[10px] uppercase text-zinc-400 block">Founder Retained Equity</span>
                    <strong className="text-xl sm:text-2xl font-black text-purple-300 block">
                      {s.founderRetainedPercent}%
                    </strong>
                    <span className="text-[10px] text-zinc-400 block">
                      Dilution: {s.dilutionPercent}% to investors
                    </span>
                  </div>
                </div>

                {/* Capital Breakdown & Shares Distribution */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Capital Breakdown Box */}
                  <Card className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h4 className="font-bold text-xs uppercase text-zinc-300 flex items-center gap-1.5 font-mono">
                        <Coins className="h-4 w-4 text-emerald-400" /> Capital Source Breakdown
                      </h4>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {formatINR(s.totalRaised)}
                      </span>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-cyan-400" /> Retail Audience Capital:
                        </span>
                        <strong className="text-cyan-300">{formatINR(cb?.retailCapital || 0)}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-zinc-400 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-amber-400" /> Institutional / VC Capital:
                        </span>
                        <strong className="text-amber-300">{formatINR(cb?.fiiCapital || 0)}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-zinc-400">Target Funding Goal:</span>
                        <span className="text-zinc-300">{formatINR(s.fundingAsk)}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                        <span>Funding Milestone</span>
                        <span>{cb?.subscriptionPercent}% Achieved</span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, cb?.subscriptionPercent || 0)}%` }}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Share Capital Pool & Dilution */}
                  <Card className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h4 className="font-bold text-xs uppercase text-zinc-300 flex items-center gap-1.5 font-mono">
                        <PieChart className="h-4 w-4 text-purple-400" /> Share Capital & Float
                      </h4>
                      <span className="text-xs font-mono font-bold text-purple-300">
                        {s.totalShares.toLocaleString("en-IN")} Shares
                      </span>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-zinc-400">Total Authorized Pool:</span>
                        <strong className="text-white">{s.totalShares.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-zinc-400">Shares Held by Investors:</span>
                        <strong className="text-emerald-300">{s.totalInvestorShares.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-zinc-400">Remaining Available Stock:</span>
                        <strong className="text-cyan-300">{s.availableShares.toLocaleString("en-IN")}</strong>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-zinc-400">Investor Backers Count:</span>
                        <strong className="text-amber-300">{capTable.length} Backers</strong>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB 2: INVESTOR CAP TABLE */}
            {activeTab === "captable" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold uppercase text-zinc-300">
                    Official Shareholder Cap Table ({capTable.length} Investors)
                  </h4>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Total Dilution: {s.dilutionPercent}%
                  </span>
                </div>

                {capTable.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-zinc-400 border border-white/10 rounded-2xl bg-white/[0.02]">
                    No investors currently own shares in this company.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5 text-[11px] font-mono text-zinc-400">
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Investor Name</TableHead>
                          <TableHead>Investor Type</TableHead>
                          <TableHead className="text-right">Shares Owned</TableHead>
                          <TableHead className="text-right">Capital Invested</TableHead>
                          <TableHead className="text-right">Avg Price</TableHead>
                          <TableHead className="text-right">Current Value</TableHead>
                          <TableHead className="text-right pr-4">Equity %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="font-mono text-xs">
                        {capTable.map((row: any) => (
                          <TableRow key={row.userId} className="border-white/5 hover:bg-white/[0.02]">
                            <TableCell className="text-center text-zinc-400 font-bold">{row.rank}</TableCell>
                            <TableCell className="font-bold text-white">{row.name}</TableCell>
                            <TableCell>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  row.role === "FII"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                }`}
                              >
                                {row.role === "FII" ? "Institutional VC" : "Retail Investor"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-emerald-300">
                              {row.shares.toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell className="text-right text-zinc-300">
                              {formatINR(row.totalInvested)}
                            </TableCell>
                            <TableCell className="text-right text-zinc-400">
                              {formatSharePrice(row.averageBuyPrice)}
                            </TableCell>
                            <TableCell className="text-right font-bold text-white">
                              {formatINR(row.currentValue)}
                            </TableCell>
                            <TableCell className="text-right pr-4 font-bold text-amber-300">
                              {row.equityPercent}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: RECENT TRADES */}
            {activeTab === "trades" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold uppercase text-zinc-300">
                    Live Stock Exchange Trades Log
                  </h4>
                  <span className="text-[11px] font-mono text-zinc-400">
                    Volume: {s.totalVolume.toLocaleString()} shares
                  </span>
                </div>

                {trades.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-zinc-400 border border-white/10 rounded-2xl bg-white/[0.02]">
                    No market trades executed yet for this stock.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5 text-[11px] font-mono text-zinc-400">
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead>Trade ID</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>Seller</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Total Value</TableHead>
                          <TableHead className="text-right pr-4">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="font-mono text-xs">
                        {trades.map((t: any) => (
                          <TableRow key={t.id} className="border-white/5 hover:bg-white/[0.02]">
                            <TableCell className="text-zinc-500 font-mono text-[11px]">{t.id}</TableCell>
                            <TableCell className="text-white font-bold">{t.buyerName}</TableCell>
                            <TableCell className="text-zinc-400">{t.sellerName}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-400">
                              {formatSharePrice(t.price)}
                            </TableCell>
                            <TableCell className="text-right text-zinc-200">
                              {t.quantity.toLocaleString()} sh
                            </TableCell>
                            <TableCell className="text-right font-bold text-white">
                              {formatINR(t.amount)}
                            </TableCell>
                            <TableCell className="text-right pr-4 text-zinc-500 text-[11px]">
                              {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PITCH BRIEFING */}
            {activeTab === "pitch" && (
              <div className="space-y-4">
                <Card className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
                  <h4 className="font-bold text-xs uppercase text-zinc-300 font-mono">
                    Executive Pitch Briefing & Core Thesis
                  </h4>
                  <div className="space-y-2 text-xs leading-relaxed text-zinc-300 font-mono">
                    <div>
                      <span className="text-zinc-500 uppercase text-[10px] block">Tagline:</span>
                      <p className="font-bold text-white">{s.tagLine || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase text-[10px] block">Problem Statement:</span>
                      <p>{s.problem || s.idea}</p>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase text-[10px] block">Innovation & Solution:</span>
                      <p>{s.solution || s.pitchSummary}</p>
                    </div>
                    {s.businessModel && (
                      <div>
                        <span className="text-zinc-500 uppercase text-[10px] block">Business Model:</span>
                        <p>{s.businessModel}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
