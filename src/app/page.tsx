"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/formatters";
import { getUserDisplayIdentifier, getUserTokenOnly } from "@/lib/tokens";
import {
  ShieldCheck,
  Building2,
  Users,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle,
  LogOut,
  Flame,
  Ticket,
  KeyRound,
  Sparkles,
  HelpCircle,
  X,
  Lock,
  Loader2,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RoleOption = "RETAIL" | "FII" | "STARTUP" | "ADMIN";

interface RoleConfig {
  id: RoleOption;
  title: string;
  tabLabel: string;
  description: string;
  badgeText: string;
  isPassword?: boolean;
  icon: React.ElementType;
  accentColor: string;
  accentBorder: string;
  accentBg: string;
  btnGradient: string;
  activeTabStyle: string;
  dotActive: string;
}

const ROLE_OPTIONS: RoleConfig[] = [
  {
    id: "RETAIL",
    title: "Audience Investor",
    tabLabel: "Audience",
    description: "Live IPO trading, order book bids & personal portfolio",
    badgeText: "Attendee Passkey",
    icon: Users,
    accentColor: "text-emerald-400",
    accentBorder: "border-emerald-500/35",
    accentBg: "bg-emerald-500/10",
    btnGradient: "from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-emerald-500/25",
    activeTabStyle: "border-emerald-500/80 bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]",
    dotActive: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  },
  {
    id: "FII",
    title: "VC Judge",
    tabLabel: "VC Judge",
    description: "Institutional term sheets, multi-lakh cheques & cap table",
    badgeText: "Judge Passkey",
    icon: Building2,
    accentColor: "text-amber-400",
    accentBorder: "border-amber-500/35",
    accentBg: "bg-amber-500/10",
    btnGradient: "from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-400 shadow-amber-500/25",
    activeTabStyle: "border-amber-500/80 bg-amber-500/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    dotActive: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  },
  {
    id: "STARTUP",
    title: "Startup Founder",
    tabLabel: "Founder",
    description: "Founding team pitch desk, investor interest & live valuation",
    badgeText: "Founder Passkey",
    icon: Flame,
    accentColor: "text-cyan-400",
    accentBorder: "border-cyan-500/35",
    accentBg: "bg-cyan-500/10",
    btnGradient: "from-cyan-400 to-blue-500 text-black hover:from-cyan-300 hover:to-blue-400 shadow-cyan-500/25",
    activeTabStyle: "border-cyan-500/80 bg-cyan-500/20 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.25)]",
    dotActive: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
  },
  {
    id: "ADMIN",
    title: "Event Director",
    tabLabel: "Admin",
    description: "Master clock, emergency circuit breakers & stage governance",
    badgeText: "Director Passkey",
    isPassword: true,
    icon: ShieldCheck,
    accentColor: "text-rose-400",
    accentBorder: "border-rose-500/35",
    accentBg: "bg-rose-500/10",
    btnGradient: "from-rose-500 to-pink-500 text-white hover:from-rose-400 hover:to-pink-400 shadow-rose-500/25",
    activeTabStyle: "border-rose-500/80 bg-rose-500/20 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.25)]",
    dotActive: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, login, loginByToken, logout } = useAuth();
  const [activeRole, setActiveRole] = useState<RoleOption>("RETAIL");
  const [tokenInput, setTokenInput] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      router.prefetch("/teams");
      router.prefetch("/fii");
      router.prefetch("/admin");
      router.prefetch("/market");
      router.prefetch("/leaderboard");
      router.prefetch("/portfolio");
    } catch {}
  }, [router]);

  const getRoleDestination = (role: string, startupId?: string | null) => {
    switch (role) {
      case "ADMIN":
        return "/admin";
      case "FII":
        return "/fii";
      case "STARTUP":
        return startupId ? `/startup/${startupId.replace("startup-", "")}` : "/teams";
      case "RETAIL":
      default:
        return "/teams";
    }
  };

  const handleSelectRole = (role: RoleOption) => {
    setActiveRole(role);
    setErrorMsg("");
    setTokenInput("");
    setAdminPassword("");
  };

  const handleTokenSubmit = async (tokenToUse?: string) => {
    const tokenToVerify = (tokenToUse || tokenInput).trim();
    if (!tokenToVerify || tokenToVerify.length !== 6) {
      setErrorMsg("Please enter a valid 6-digit access passkey.");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await loginByToken(tokenToVerify);
      if (res.success && res.user) {
        const dest = getRoleDestination(res.user.role, res.user.startupId);
        router.push(dest);
      } else {
        setErrorMsg(res.message || "Invalid 6-digit passkey. Please check your badge or ask the registration desk.");
      }
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSubmit = async (passToUse?: string) => {
    const pass = passToUse !== undefined ? passToUse : adminPassword;
    if (!pass) {
      setErrorMsg("Please enter the Director password.");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await login("admin@ideaipo.com", pass, "ADMIN");
      if (res.success && res.user) {
        router.push("/admin");
      } else {
        setErrorMsg(res.message || "Incorrect Director password. Access restricted.");
      }
    } catch {
      setErrorMsg("Network connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentOpt = ROLE_OPTIONS.find((r) => r.id === activeRole) || ROLE_OPTIONS[0];

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#060810] text-zinc-100 flex flex-col justify-between selection:bg-amber-500/20 selection:text-amber-200">
      {/* 1. KEYNOTE AUDITORIUM BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/auditorium-bg.webp"
          alt="Auditorium Keynote Background"
          fill
          priority
          className="object-cover object-center filter brightness-[0.24] contrast-[1.18] saturate-[1.2]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060810]/95 via-[#070b16]/85 to-[#060810]/98" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,198,135,0.12),_transparent_70%)]" />
      </div>

      {/* Floating Ambient Glowing Lights */}
      <div className="pointer-events-none absolute top-10 left-1/4 h-[350px] w-[350px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.04] blur-[130px]" />

      {/* 2. TOP NAVIGATION: VISION CLUB & IDEA TO IPO */}
      <header className="relative z-20 flex h-20 sm:h-24 items-center justify-between px-4 sm:px-10 lg:px-14 border-b border-white/[0.08] backdrop-blur-2xl bg-[#060810]/85">
        {/* Left: Enlarged Vision Club Logo */}
        <div className="flex items-center shrink-0">
          <div className="relative h-9 sm:h-12 w-28 sm:w-44 transition-transform duration-200 hover:scale-105">
            <Image
              src="/vision-club-logo.png"
              alt="Vision Club"
              fill
              priority
              className="object-contain object-left filter drop-shadow-[0_0_16px_rgba(230,198,135,0.45)]"
            />
          </div>
        </div>

        {/* Center: IDEA TO IPO Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
          <div className="relative h-7 sm:h-10 w-36 sm:w-[258px] transition-transform duration-200 hover:scale-105">
            <Image
              src="/idea-to-ipo-header.png"
              alt="IDEA TO IPO"
              fill
              priority
              className="object-contain object-center filter drop-shadow-[0_0_16px_rgba(212,175,55,0.45)]"
            />
          </div>
        </div>

        {/* Right: Live indicator or Sign Out */}
        <div className="flex items-center justify-end gap-3 min-w-[44px]">
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-[11px] font-mono text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE AUDITORIUM FLOOR
          </div>

          {user && (
            <button
              onClick={logout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 text-xs font-mono text-zinc-300 hover:text-rose-400 hover:bg-white/10 hover:border-rose-500/30 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* 3. MAIN CONTENT: CLEAN, MODERN, HIGHLY USER-FRIENDLY */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 max-w-lg mx-auto w-full">
        <div className="w-full space-y-5">
          {/* Header Title & Description */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-mono text-zinc-400">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Interactive IPO Pitch & Trading Simulation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Enter Simulation Floor
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-mono">
              Select your event role and enter your 6-digit access passkey
            </p>
          </div>

          {/* Login Card Container */}
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-[#0e1424]/95 to-[#060810]/95 p-5 sm:p-7 backdrop-blur-3xl shadow-2xl">
            {/* Top Accent Line */}
            <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            {user ? (
              /* Active Session Card (If User is Already Logged In) */
              <div className="space-y-4">
                <div className="flex items-center gap-3.5 border-b border-white/10 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-inner">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-white font-mono truncate">{getUserDisplayIdentifier(user)}</h2>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 shrink-0">
                        {user.role}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 font-mono truncate mt-0.5">Role: {user.role} • Simulation Passkey</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-400">Authorized Capital:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {user.role === "ADMIN" ? "Unlimited (Director)" : formatINR(user.currentBalance)}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <Link
                    href={getRoleDestination(user.role, user.startupId)}
                    prefetch={true}
                    className="inline-flex items-center justify-center w-full h-11 text-xs font-mono font-bold bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-teal-300 gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99] rounded-xl"
                  >
                    Enter Simulation Floor <ArrowRight className="h-4 w-4" />
                  </Link>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={logout}
                      variant="outline"
                      className="flex-1 h-9 text-xs font-mono border-white/15 text-zinc-400 hover:text-white hover:bg-white/5"
                    >
                      <RefreshCw className="h-3 w-3 mr-1.5" /> Switch Account
                    </Button>
                    <Button
                      onClick={logout}
                      variant="outline"
                      className="flex-1 h-9 text-xs font-mono border-white/15 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
                    >
                      <LogOut className="h-3 w-3 mr-1.5" /> Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Role Selection & Clean Input Form */
              <div className="space-y-4">
                {/* 4 Role Tabs */}
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2 font-semibold">
                    1. Select Your Event Role
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {ROLE_OPTIONS.map((opt) => {
                      const isSelected = activeRole === opt.id;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectRole(opt.id)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all duration-200 active:scale-95 ${
                            isSelected
                              ? `${opt.activeTabStyle} font-bold ring-1 ring-white/10`
                              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.06]"
                          }`}
                        >
                          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mb-1.5 transition-colors ${isSelected ? opt.accentColor : "text-zinc-400"}`} />
                          <span className="text-[11px] font-bold leading-tight truncate w-full">
                            {opt.tabLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Role Card & Form */}
                <div className={`rounded-2xl border ${currentOpt.accentBorder} ${currentOpt.accentBg} p-4 sm:p-5 space-y-4 transition-all duration-200`}>
                  {/* Role Header Info */}
                  <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{currentOpt.title}</span>
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${currentOpt.accentBorder} bg-black/40 ${currentOpt.accentColor}`}>
                          {currentOpt.badgeText}
                        </span>
                      </h3>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {currentOpt.description}
                      </p>
                    </div>
                  </div>

                  {/* Error Notification */}
                  {errorMsg && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in duration-200">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <div className="flex-1 font-mono text-[11px] leading-tight">{errorMsg}</div>
                      <button
                        type="button"
                        onClick={() => setErrorMsg("")}
                        className="text-rose-400 hover:text-white p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {currentOpt.isPassword ? (
                    /* Admin Master Password Form */
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAdminSubmit();
                      }}
                      className="space-y-3.5"
                    >
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-mono text-zinc-300 font-semibold">
                          Event Director Password
                        </label>
                        <div className="relative">
                          <Input
                            type={showAdminPassword ? "text" : "password"}
                            placeholder="Enter master password..."
                            value={adminPassword}
                            onChange={(e) => {
                              setAdminPassword(e.target.value);
                              if (errorMsg) setErrorMsg("");
                            }}
                            className="h-12 text-sm text-white placeholder:text-zinc-500 font-mono rounded-xl pl-9 pr-20 border-white/20 bg-black/60 focus-visible:ring-rose-500/50"
                            required
                            autoFocus
                          />
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {adminPassword && (
                              <button
                                type="button"
                                onClick={() => setAdminPassword("")}
                                className="p-1 text-zinc-400 hover:text-white"
                                title="Clear"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              className="p-1 text-zinc-400 hover:text-zinc-200"
                              title={showAdminPassword ? "Hide password" : "Show password"}
                            >
                              {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSubmitting || !adminPassword}
                        className={`w-full h-11 text-xs font-mono font-bold bg-gradient-to-r ${currentOpt.btnGradient} transition-all active:scale-[0.99]`}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Verifying Credentials...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Lock className="h-4 w-4" /> Unlock Mission Control
                          </span>
                        )}
                      </Button>

                      {/* Security Notice */}
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 flex items-start gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span className="text-[10px] font-mono text-zinc-400 leading-normal">
                          Restricted to authorized event directors. Live market commands and stage transitions are logged.
                        </span>
                      </div>
                    </form>
                  ) : (
                    /* 6-Digit Passkey Token Form */
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleTokenSubmit();
                      }}
                      className="space-y-3.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-mono text-zinc-300 font-semibold">
                            Enter 6-Digit Access Passkey
                          </label>
                          <span className="text-[10px] font-mono text-zinc-400">
                            {tokenInput.length} / 6 digits
                          </span>
                        </div>

                        {/* Large, Legible 6-Digit Token Box */}
                        <div className="relative">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="••••••"
                            value={tokenInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                              setTokenInput(val);
                              if (errorMsg) setErrorMsg("");
                              if (val.length === 6) {
                                handleTokenSubmit(val);
                              }
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                              setTokenInput(pasted);
                              if (errorMsg) setErrorMsg("");
                              if (pasted.length === 6) {
                                handleTokenSubmit(pasted);
                              }
                            }}
                            className="h-14 text-center text-xl sm:text-2xl font-mono font-extrabold tracking-[0.45em] text-white placeholder:text-zinc-600 rounded-2xl border-white/20 bg-black/60 focus-visible:ring-emerald-500/50 shadow-inner"
                            required
                            autoFocus
                          />
                          <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                          {tokenInput.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setTokenInput("");
                                setErrorMsg("");
                              }}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                              title="Clear code"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* 6 Digit Slot Indicators */}
                        <div className="flex items-center justify-center gap-2 pt-1 pb-0.5">
                          {[0, 1, 2, 3, 4, 5].map((idx) => {
                            const isFilled = tokenInput.length > idx;
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "h-1.5 rounded-full transition-all duration-200",
                                  isFilled ? `w-6 ${currentOpt.dotActive}` : "w-3 bg-white/20"
                                )}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Submit CTA Button */}
                      <Button
                        type="submit"
                        disabled={isSubmitting || tokenInput.length < 6}
                        className={`w-full h-11 text-xs font-mono font-bold bg-gradient-to-r ${currentOpt.btnGradient} transition-all active:scale-[0.99]`}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Verifying Passkey...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span>Enter Simulation as {currentOpt.tabLabel}</span>
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        )}
                      </Button>

                      {/* Helpful User Guidance */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left flex items-start gap-2.5">
                        <HelpCircle className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed text-zinc-400 font-mono">
                          <span className="text-zinc-200 font-bold block mb-0.5">Where is my passkey?</span>
                          Your unique 6-digit access code is printed on your auditorium badge or provided at registration. If you haven't received one, contact the event desk.
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 4. FOOTER */}
      <footer className="relative z-10 py-4 px-4 text-center text-[11px] font-mono text-zinc-500 border-t border-white/[0.05] bg-[#060810]/60 backdrop-blur-md">
        Vision Club • Pitch. Plan. Protect. Prosper.
      </footer>
    </div>
  );
}
