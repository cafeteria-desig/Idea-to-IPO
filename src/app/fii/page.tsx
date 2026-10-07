"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { useAuth } from "@/context/AuthContext";
import { formatINR, getSubscriptionStatus } from "@/lib/formatters";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Building2,
  ShieldCheck,
  Award,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import type { StartupItem } from "@/types";

export default function FIITerminalPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [selectedStartup, setSelectedStartup] = useState<StartupItem | null>(null);
  const [selectedCheque, setSelectedCheque] = useState<number>(2500000);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ success?: boolean; text?: string } | null>(null);

  // Institutional Presets (Spec §8.7: ₹10L, ₹25L, ₹50L, ₹1Cr)
  const institutionalCheques = [
    { label: "₹10 Lakhs", value: 1000000 },
    { label: "₹25 Lakhs", value: 2500000 },
    { label: "₹50 Lakhs", value: 5000000 },
    { label: "₹1 Crore", value: 10000000 },
  ];

  const cacheRef = React.useRef<string>("");

  const fetchStartups = async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/startups", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        if (text !== cacheRef.current) {
          cacheRef.current = text;
          const data = JSON.parse(text);
          setStartups(data);
          if (!selectedStartup && data.length > 0) {
            setSelectedStartup(data[0]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStartups();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchStartups();
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenConfirm = (startup: StartupItem) => {
    setSelectedStartup(startup);
    setStatusMsg(null);
    setConfirmModalOpen(true);
  };

  const handleExecuteCheque = async () => {
    if (!selectedStartup || !user) return;
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startupId: selectedStartup.id,
          amount: selectedCheque,
          userId: user.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        confetti({
          particleCount: 150,
          spread: 80,
          colors: ["#f59e0b", "#00e599", "#ffffff"],
        });

        setStatusMsg({
          success: true,
          text: `Cheque executed! ${data.transactionId} confirmed for ${formatINR(data.amount)}.`,
        });

        await refreshUser();
        await fetchStartups();

        setTimeout(() => {
          setConfirmModalOpen(false);
          setStatusMsg(null);
        }, 2000);
      } else {
        setStatusMsg({
          success: false,
          text: data.message || "Failed to execute cheque.",
        });
      }
    } catch (err) {
      setStatusMsg({ success: false, text: "Network connection failure." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4 sm:pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            VC Cheque Console
          </h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-3 sm:p-4 px-4 sm:px-6 backdrop-blur-2xl shadow-[0_0_25px_rgba(245,158,11,0.15)]">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">FII Capital Capacity</span>
            <span className="text-base sm:text-xl font-mono font-black text-amber-400">
              {formatINR(user?.currentBalance || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Cheque Preset Buttons */}
      <div className="glass-panel-premium p-4 sm:p-8">
        <h2 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-amber-400" />
          Select Standard Institutional Cheque Size
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          {institutionalCheques.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setSelectedCheque(item.value)}
              className={`flex flex-col items-center justify-center rounded-2xl border p-3.5 sm:p-5 transition-all duration-200 active:scale-95 ${
                selectedCheque === item.value
                  ? "border-amber-500 bg-amber-500/20 text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.25)] scale-[1.02]"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Cheque Tier</span>
              <span className="text-base sm:text-xl font-mono font-black text-white mt-1 sm:mt-1.5">{item.label}</span>
              <span className="text-[11px] sm:text-xs font-mono text-amber-400/90 mt-0.5 sm:mt-1 font-semibold">
                {formatINR(item.value, false)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Startup Cards with Institutional Diligence Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-8 lg:gap-10">
        {startups.map((startup, index) => {
          const sub = getSubscriptionStatus(startup.totalInvestmentReceived, startup.fundingAsk);
          const isOpen = startup.ipoStatus === "IPO_OPEN";

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
                className={`relative h-full flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-b from-[#0e1424]/90 via-[#0a0f1c]/90 to-[#060911]/90 backdrop-blur-2xl shadow-xl transition-all duration-300 hover:border-amber-500/40 hover:shadow-glass-card-hover group ${
                  isOpen ? "border-amber-500/40 ring-1 ring-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.08)]" : "opacity-80"
                }`}
              >
                {isOpen && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
                )}

                <CardHeader className="p-7 sm:p-8 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="rounded-md bg-white/10 border border-white/15 px-2.5 py-0.5 text-[11px] font-mono font-bold text-zinc-300">
                          Pitch #{startup.pitchOrder}
                        </span>
                        <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                          {startup.industry}
                        </span>
                      </div>
                      <CardTitle className="text-2xl sm:text-3xl font-black text-white group-hover:text-amber-300 transition-colors tracking-tight">
                        {startup.name}
                      </CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <StatusBadge status={startup.ipoStatus} />
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border font-bold ${sub.badgeClass}`}>
                        {sub.label}
                      </span>
                    </div>
                  </div>
                  <CardDescription className="text-sm text-zinc-400 pt-2 leading-relaxed">
                    {startup.tagLine}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-7 sm:p-8 pt-2 space-y-6">
                  {/* Due Diligence Metric Grid */}
                  <div className="grid grid-cols-3 gap-3.5">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-center transition-all group-hover:border-white/15">
                      <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Target Ask</span>
                      <span className="text-sm sm:text-base font-mono font-black text-white mt-1 block">
                        {formatINR(startup.fundingAsk)}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-center transition-all group-hover:border-cyan-500/25">
                      <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Equity Pool</span>
                      <span className="text-sm sm:text-base font-mono font-black text-cyan-400 mt-1 block">
                        {startup.equityOffered}%
                      </span>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-center transition-all group-hover:border-amber-500/25">
                      <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">FII Inflow</span>
                      <span className="text-sm sm:text-base font-mono font-black text-amber-400 mt-1 block drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                        {formatINR(startup.fiiInvestment)}
                      </span>
                    </div>
                  </div>

                  {/* Problem & Solution Brief */}
                  <div className="space-y-2.5 text-xs">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-1">
                      <span className="font-mono text-[10px] font-bold uppercase text-rose-400 tracking-wider">Market Problem</span>
                      <p className="text-zinc-300 leading-relaxed text-xs sm:text-sm">{startup.problem}</p>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-1">
                      <span className="font-mono text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Solution Architecture</span>
                      <p className="text-zinc-300 leading-relaxed text-xs sm:text-sm">{startup.solution}</p>
                    </div>
                  </div>

                  {/* Valuation & Dilution Preview */}
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-300">Selected Cheque Dilution:</span>
                    <span className="font-bold text-amber-400 text-sm">
                      {startup.fundingAsk > 0
                        ? `${((selectedCheque / startup.fundingAsk) * (startup.equityOffered ?? 0)).toFixed(2)}% Equity`
                        : "—"}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="p-7 sm:p-8 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-4 mt-auto">
                  <Link
                    href={`/startup/${startup.slug}`}
                    prefetch={true}
                    className="inline-flex items-center justify-center h-11 px-4 rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:border-cyan-500/40 hover:bg-white/10 hover:text-white font-mono text-xs transition-all active:scale-[0.98]"
                  >
                    <FileText className="h-3.5 w-3.5 mr-1.5 text-cyan-400" /> Dossier
                  </Link>

                  <Button
                    onClick={() => handleOpenConfirm(startup)}
                    disabled={!isOpen}
                    className={`h-11 px-6 rounded-xl font-mono text-xs font-bold gap-2.5 transition-all ${
                      isOpen
                        ? "bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-orange-300 shadow-[0_0_20px_rgba(245,158,11,0.25)] shimmer-sweep hover:scale-105 active:scale-95"
                        : "opacity-40 cursor-not-allowed bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {isOpen ? `Deploy ${formatINR(selectedCheque)} Cheque` : "IPO Not Open"}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 2-Step Due Diligence Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="fixed bottom-0 top-auto left-0 right-0 sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-white/15 bg-[#0a0f1e]/98 p-5 sm:p-6 backdrop-blur-3xl shadow-2xl safe-bottom max-h-[92vh] overflow-y-auto">
          {selectedStartup && (
            <>
              <div className="mx-auto w-12 h-1.5 rounded-full bg-white/20 mb-3 sm:hidden" />
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1 text-amber-400 text-xs font-mono font-bold uppercase">
                  <AlertTriangle className="h-4 w-4" /> Two-Step Institutional Confirmation
                </div>
                <DialogTitle className="text-xl font-bold">
                  Deploy Institutional Cheque
                </DialogTitle>
                <DialogDescription>
                  Confirm venture allocation of {formatINR(selectedCheque)} into {selectedStartup.name}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Startup Name:</span>
                    <span className="font-bold text-white">{selectedStartup.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Target Industry:</span>
                    <span className="text-cyan-400 font-semibold">{selectedStartup.industry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Cheque Amount:</span>
                    <span className="font-bold text-amber-400 text-sm">{formatINR(selectedCheque)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-2">
                    <span className="text-zinc-400">Remaining Balance After:</span>
                    <span className="font-mono text-zinc-300">
                      {formatINR(Math.max(0, (user?.currentBalance || 0) - selectedCheque))}
                    </span>
                  </div>
                </div>

                {statusMsg && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-3 text-xs font-mono ${
                      statusMsg.success
                        ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "border border-rose-500/40 bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    {statusMsg.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <span>{statusMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons: Confirm is PRIMARY and on top! */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleExecuteCheque}
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-mono text-xs sm:text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 active:scale-95 transition-all"
                >
                  {isSubmitting ? "Executing Cheque..." : "Execute Binding Cheque"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmModalOpen(false)}
                  disabled={isSubmitting}
                  className="w-full h-10 font-mono text-xs border-white/15 text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
