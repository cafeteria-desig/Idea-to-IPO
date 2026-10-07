"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatSharePrice, formatDate } from "@/lib/formatters";
import { getUserDisplayIdentifier } from "@/lib/tokens";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  CreditCard,
  Sliders,
  History,
  Trophy,
  RefreshCw,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Ban,
  Lock,
  Unlock,
  UserPlus,
  Eye,
  EyeOff,
  Ticket,
  TrendingUp,
  Zap,
  Sparkles,
  Layers,
  Play,
  Pause,
  Square,
  Mic,
  MessageSquare,
  Loader2,
  KeyRound,
  AlertCircle,
  Search,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Building2,
  ExternalLink,
  Crown,
  Award,
  Flame,
  Medal,
} from "lucide-react";
import type { StartupItem, SafeUser, InvestmentItem, AuditLogItem, FinalAwardItem, IPOStatus } from "@/types";
import { getUserLoginToken, generateRandomToken } from "@/lib/tokens";

export default function AdminControlRoomPage() {
  const { user, login, isLoading } = useAuth();
  const [transitioningStartupId, setTransitioningStartupId] = useState<string | null>(null);

  // Director Gate State (if user is not admin)
  const [adminPassInput, setAdminPassInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Control Room Data
  const [marketState, setMarketState] = useState<{
    isMarketActive: boolean;
    activeStartupId?: string | null;
    bannerMessage?: string | null;
    hideInvestorNamesPublicly: boolean;
  } | null>(null);

  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [transactions, setTransactions] = useState<InvestmentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [awardsData, setAwardsData] = useState<{
    awards: FinalAwardItem[];
    startups: StartupItem[];
    recommendations: Record<string, { startupId: string; startupName: string; metric: string }>;
  } | null>(null);

  const [bannerInput, setBannerInput] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Capital Adjustment Modal State
  const [adjustUser, setAdjustUser] = useState<SafeUser | null>(null);
  const [newCapital, setNewCapital] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState("");

  // Override Form State
  const [overrideStartupId, setOverrideStartupId] = useState("");
  const [overrideNewTotal, setOverrideNewTotal] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState("");

  // Create User Modal State
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserToken, setNewUserToken] = useState("");
  const [newUserRole, setNewUserRole] = useState<"RETAIL" | "FII" | "STARTUP" | "ADMIN">("RETAIL");
  const [newUserCapital, setNewUserCapital] = useState<number>(500000);
  const [newUserStartupId, setNewUserStartupId] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserError, setNewUserError] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");

  // Team Registration Form State
  const [registerTeamModalOpen, setRegisterTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamIdea, setTeamIdea] = useState("");
  const [teamTagline, setTeamTagline] = useState("");
  const [teamIndustry, setTeamIndustry] = useState("Fintech & Web3");
  const [teamAsk, setTeamAsk] = useState<number>(10000000);
  const [teamSharePrice, setTeamSharePrice] = useState<number>(100);
  const [teamEquity, setTeamEquity] = useState<number>(10);
  const [teamPitchOrder, setTeamPitchOrder] = useState<number>(1);
  const [teamStatus, setTeamStatus] = useState<IPOStatus>("IPO_OPEN");
  const [teamFounderName, setTeamFounderName] = useState("");
  const [teamProblem, setTeamProblem] = useState("");
  const [teamSolution, setTeamSolution] = useState("");
  const [isRegisteringTeam, setIsRegisteringTeam] = useState(false);
  const [registerTeamError, setRegisterTeamError] = useState("");

  // Delete Team State
  const [deleteStartupConfirmId, setDeleteStartupConfirmId] = useState<string | null>(null);
  const [isDeletingStartup, setIsDeletingStartup] = useState(false);

  // Clear Trial Teams State
  const [clearTrialsModalOpen, setClearTrialsModalOpen] = useState(false);
  const [isClearingTrials, setIsClearingTrials] = useState(false);

  const cacheRef = React.useRef<{ [key: string]: string }>({});

  const refreshAllAdminData = async () => {
    if (typeof document !== "undefined" && document.hidden) return;

    try {
      const [mRes, sRes, uRes, tRes, aRes, awRes] = await Promise.all([
        fetch("/api/market/state", { cache: "no-store" }),
        fetch("/api/startups", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/transactions", { cache: "no-store" }),
        fetch("/api/admin/audit-logs", { cache: "no-store" }),
        fetch("/api/admin/awards", { cache: "no-store" }),
      ]);

      if (mRes.ok) {
        const m = await mRes.json();
        const mStr = JSON.stringify(m);
        if (cacheRef.current.market !== mStr) {
          cacheRef.current.market = mStr;
          setMarketState(m);
          setBannerInput((prev) => (prev === "" ? m.bannerMessage || "" : prev));
        }
      }
      if (sRes.ok) {
        const s = await sRes.json();
        const sStr = JSON.stringify(s);
        if (cacheRef.current.startups !== sStr) {
          cacheRef.current.startups = sStr;
          setStartups(s);
        }
      }
      if (uRes.ok) {
        const u = await uRes.json();
        const uStr = JSON.stringify(u);
        if (cacheRef.current.users !== uStr) {
          cacheRef.current.users = uStr;
          setUsersList(u);
        }
      }
      if (tRes.ok) {
        const t = await tRes.json();
        const tStr = JSON.stringify(t);
        if (cacheRef.current.transactions !== tStr) {
          cacheRef.current.transactions = tStr;
          setTransactions(t);
        }
      }
      if (aRes.ok) {
        const a = await aRes.json();
        const aStr = JSON.stringify(a);
        if (cacheRef.current.audits !== aStr) {
          cacheRef.current.audits = aStr;
          setAuditLogs(a);
        }
      }
      if (awRes.ok) {
        const aw = await awRes.json();
        const awStr = JSON.stringify(aw);
        if (cacheRef.current.awards !== awStr) {
          cacheRef.current.awards = awStr;
          setAwardsData(aw);
        }
      }
    } catch (err) {
      console.error("Admin refresh error:", err);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      refreshAllAdminData();
      const interval = setInterval(refreshAllAdminData, 4000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const flashMessage = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  // 1. Toggle Circuit Breaker
  const handleToggleFreeze = async () => {
    if (!marketState) return;
    const nextState = !marketState.isMarketActive;
    try {
      const res = await fetch("/api/admin/market/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isMarketActive: nextState,
          reason: nextState ? "Admin resumed live bidding floor" : "Emergency freeze activated",
        }),
      });
      if (res.ok) {
        flashMessage(nextState ? "Market Resumed Successfully!" : "Market FROZEN Globally!");
        await refreshAllAdminData();
      } else {
        const d = await res.json().catch(() => ({}));
        flashMessage(d.message || "Error toggling freeze.");
      }
    } catch (e) {
      flashMessage("Error toggling freeze.");
    }
  };

  // Update banner message
  const handleUpdateBanner = async () => {
    if (!marketState) return;
    try {
      const res = await fetch("/api/admin/market/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isMarketActive: marketState.isMarketActive,
          bannerMessage: bannerInput,
          reason: "Updated ticker announcement",
        }),
      });
      if (res.ok) {
        flashMessage("Broadcast ticker updated!");
        await refreshAllAdminData();
      } else {
        const d = await res.json().catch(() => ({}));
        flashMessage(d.message || "Failed to update banner.");
      }
    } catch (e) {
      flashMessage("Failed to update banner.");
    }
  };

  // Director Authentication Modal State
  const [adminAuthModalOpen, setAdminAuthModalOpen] = useState(false);
  const [adminModalPassword, setAdminModalPassword] = useState("");
  const [showAdminModalPass, setShowAdminModalPass] = useState(false);
  const [isUnlockingAdmin, setIsUnlockingAdmin] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");

  const handleDirectorAuthenticate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminModalPassword.trim()) {
      setAdminAuthError("Please enter the Director password.");
      return;
    }
    setAdminAuthError("");
    setIsUnlockingAdmin(true);

    try {
      const res = await login("admin@ideaipo.com", adminModalPassword.trim(), "ADMIN");
      if (res.success) {
        flashMessage("✓ Director Privileges Activated! All Controls Unlocked.");
        setAdminAuthModalOpen(false);
        setAdminModalPassword("");
        await refreshAllAdminData();
      } else {
        setAdminAuthError(res.message || "Incorrect password. Director authorization failed.");
      }
    } catch {
      setAdminAuthError("Network connection failure. Please try again.");
    } finally {
      setIsUnlockingAdmin(false);
    }
  };

  // 1b. Register Startup Team
  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterTeamError("");

    if (!teamName.trim()) {
      setRegisterTeamError("Team / Startup name is required.");
      return;
    }
    if (!teamIdea.trim()) {
      setRegisterTeamError("Startup idea / pitch summary is required.");
      return;
    }
    if (!teamAsk || teamAsk <= 0) {
      setRegisterTeamError("Funding Ask must be greater than 0.");
      return;
    }
    if (!teamSharePrice || teamSharePrice <= 0) {
      setRegisterTeamError("Share value must be greater than 0.");
      return;
    }

    setIsRegisteringTeam(true);

    try {
      const res = await fetch("/api/admin/startups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "user-admin",
        },
        body: JSON.stringify({
          adminId: user?.id || "user-admin",
          name: teamName.trim(),
          idea: teamIdea.trim(),
          pitchSummary: teamIdea.trim(),
          tagLine: teamTagline.trim() || teamIdea.trim().slice(0, 80),
          industry: teamIndustry,
          fundingAsk: Number(teamAsk),
          shareValue: Number(teamSharePrice),
          equityOffered: Number(teamEquity),
          pitchOrder: Number(teamPitchOrder) || startups.length + 1,
          ipoStatus: teamStatus,
          founderName: teamFounderName.trim(),
          problem: teamProblem.trim() || teamIdea.trim(),
          solution: teamSolution.trim() || teamIdea.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to register team.");
      }

      flashMessage(`🚀 Team "${data.startup?.name}" registered and live on the exchange!`);
      setRegisterTeamModalOpen(false);
      setTeamName("");
      setTeamIdea("");
      setTeamTagline("");
      setTeamFounderName("");
      setTeamProblem("");
      setTeamSolution("");
      await refreshAllAdminData();
    } catch (err: any) {
      setRegisterTeamError(err.message || "An error occurred while registering the team.");
    } finally {
      setIsRegisteringTeam(false);
    }
  };

  // 1c. Delete Startup Team
  const handleDeleteStartup = async (startupId: string) => {
    setIsDeletingStartup(true);
    try {
      const res = await fetch(`/api/admin/startups/${startupId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "user-admin",
        },
        body: JSON.stringify({ adminId: user?.id || "user-admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete team.");
      }
      flashMessage(data.message || "Team deleted successfully.");
      setDeleteStartupConfirmId(null);
      await refreshAllAdminData();
    } catch (err: any) {
      flashMessage(err.message || "Error deleting startup.");
    } finally {
      setIsDeletingStartup(false);
    }
  };

  // 1d. Clear All Trial Teams & Reset
  const handleClearTrialTeams = async () => {
    setIsClearingTrials(true);
    try {
      const res = await fetch("/api/admin/startups/clear-trials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "user-admin",
        },
        body: JSON.stringify({ adminId: user?.id || "user-admin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to purge trial teams.");
      }
      flashMessage("✓ Purged all trial teams and dummy transactions!");
      setClearTrialsModalOpen(false);
      await refreshAllAdminData();
    } catch (err: any) {
      flashMessage(err.message || "Error purging trial teams.");
    } finally {
      setIsClearingTrials(false);
    }
  };

  // 2. Change Startup IPO Status
  const handleStatusChange = async (startupId: string, status: IPOStatus) => {
    setTransitioningStartupId(`${startupId}-${status}`);
    try {
      const res = await fetch(`/api/admin/startups/${startupId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "user-admin",
        },
        body: JSON.stringify({
          status,
          reason: `Admin stage transition to ${status}`,
          adminId: user?.id || "user-admin",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.success) {
        flashMessage(`✓ ${d.startup?.name || "Startup"} is now ${status.replace("_", " ")}!`);
        await refreshAllAdminData();
      } else {
        flashMessage(d.message || "Status transition failed.");
      }
    } catch (e) {
      flashMessage("Status transition failed.");
    } finally {
      setTransitioningStartupId(null);
    }
  };

  // 3. User block / unblock
  const handleToggleUserStatus = async (targetUser: SafeUser) => {
    const nextStatus = targetUser.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason: "Admin suspension toggle" }),
      });
      if (res.ok) {
        flashMessage(`User status set to ${nextStatus}`);
        await refreshAllAdminData();
      } else {
        const d = await res.json().catch(() => ({}));
        flashMessage(d.message || "Failed to change user status.");
      }
    } catch (e) {
      flashMessage("Failed to change user status.");
    }
  };

  // Handle User Role Selection
  const handleRoleChange = (role: "RETAIL" | "FII" | "STARTUP" | "ADMIN") => {
    setNewUserRole(role);
    if (role === "FII") {
      setNewUserCapital(10000000); // 1 Cr default
    } else if (role === "RETAIL") {
      setNewUserCapital(500000); // 5 L default
    } else {
      setNewUserCapital(0);
    }
  };

  // Submit Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError("");
    setIsCreatingUser(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserRole === "ADMIN" ? (newUserPassword || "Bhavishy@2007") : (newUserToken || newUserPassword),
          token: newUserRole === "ADMIN" ? undefined : (newUserToken || undefined),
          role: newUserRole,
          startingCapital: Number(newUserCapital),
          phone: newUserPhone,
          startupId: newUserRole === "STARTUP" && newUserStartupId ? newUserStartupId : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const assignedToken = data.token || data.user?.token || newUserToken;
        const successMsg = newUserRole === "ADMIN" ? "Pass: Bhavishy@2007" : `Login Token: ${assignedToken}`;
        flashMessage(`Account for ${newUserName} (${newUserRole}) provisioned! ${successMsg}`);
        setCreateUserModalOpen(false);
        // Reset form
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserToken(generateRandomToken());
        setNewUserRole("RETAIL");
        setNewUserCapital(500000);
        setNewUserStartupId("");
        setNewUserPhone("");
        await refreshAllAdminData();
      } else {
        setNewUserError(data.message || "Failed to create user account");
      }
    } catch (err) {
      setNewUserError("Network error while creating account");
    } finally {
      setIsCreatingUser(false);
    }
  };

  // 4. Submit Capital Adjustment
  const handleAdjustCapitalSubmit = async () => {
    if (!adjustUser) return;
    try {
      const res = await fetch(`/api/admin/users/${adjustUser.id}/capital`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newCapital: Number(newCapital),
          reason: adjustReason.trim() || "Administrative re-allocation",
        }),
      });
      if (res.ok) {
        flashMessage(`Capital adjusted for ${adjustUser.name}`);
        setAdjustUser(null);
        await refreshAllAdminData();
      } else {
        const d = await res.json();
        flashMessage(d.message || "Failed to adjust capital");
      }
    } catch (e) {
      flashMessage("Error during adjustment.");
    }
  };

  // 5. Cancel / Restore Transaction
  const handleTransactionAction = async (txId: string, action: "CANCEL" | "RESTORE") => {
    try {
      const res = await fetch(`/api/admin/transactions/${txId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: `Admin ${action} operation` }),
      });
      if (res.ok) {
        flashMessage(`Transaction ${txId} ${action}ED successfully!`);
        await refreshAllAdminData();
      } else {
        const d = await res.json();
        flashMessage(d.message || "Action failed");
      }
    } catch (e) {
      flashMessage("Error handling transaction.");
    }
  };

  // 6. Manual Valuation Override
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideStartupId) {
      flashMessage("Select a startup first");
      return;
    }
    if (overrideReason.trim().length < 5) {
      flashMessage("Justification must be at least 5 characters");
      return;
    }

    try {
      const res = await fetch("/api/admin/startups/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startupId: overrideStartupId,
          newTotal: Number(overrideNewTotal),
          reason: overrideReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flashMessage("Valuation overridden successfully!");
        setOverrideReason("");
        await refreshAllAdminData();
      } else {
        flashMessage(data.message || "Override failed");
      }
    } catch (e) {
      flashMessage("Network error during override.");
    }
  };

  // 7. Confirm Award
  const handleConfirmAward = async (awardKey: string, startupId: string) => {
    try {
      const res = await fetch("/api/admin/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awardKey,
          startupId,
          confirmedByAdmin: true,
        }),
      });
      if (res.ok) {
        flashMessage("Award confirmed & certified!");
        await refreshAllAdminData();
      }
    } catch (e) {
      flashMessage("Award confirmation failed.");
    }
  };

  // 8. Reset Demo DB
  const handleResetDemo = async () => {
    if (!confirm("Are you sure you want to reset the entire database to baseline?")) return;
    try {
      const res = await fetch("/api/admin/reset-demo", { method: "POST" });
      if (res.ok) {
        flashMessage("Database reset to baseline!");
        await refreshAllAdminData();
      } else {
        const d = await res.json().catch(() => ({}));
        flashMessage(d.message || "Reset failed.");
      }
    } catch (e) {
      flashMessage("Reset failed.");
    }
  };

  // 9. Stock Trading Suspension
  const handleToggleSuspend = async (startupId: string, currentSuspended: boolean) => {
    try {
      const res = await fetch(`/api/admin/stocks/${startupId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: !currentSuspended }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flashMessage(data.message || `Stock trading status updated.`);
        await refreshAllAdminData();
      } else {
        flashMessage(data.message || "Failed to update suspension.");
      }
    } catch (e) {
      flashMessage("Network error updating stock suspension.");
    }
  };

  // 10. Market Liquidity Injection
  const handleInjectLiquidity = async (startupId?: string) => {
    try {
      const res = await fetch("/api/admin/market/liquidity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startupId, resetExisting: false }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flashMessage("Market liquidity quotes successfully seeded!");
        await refreshAllAdminData();
      } else {
        flashMessage(data.message || "Failed to inject liquidity.");
      }
    } catch (e) {
      flashMessage("Network error injecting liquidity.");
    }
  };

  const ALL_STATES: IPOStatus[] = [
    "COMING_UP",
    "PITCHING",
    "QA",
    "IPO_OPEN",
    "IPO_PAUSED",
    "IPO_CLOSED",
    "UNDER_REVIEW",
    "FINALIZED",
    "DISQUALIFIED",
  ];

  const handleDirectorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassInput) {
      setLoginError("Please enter the Director password.");
      return;
    }
    setIsVerifying(true);
    setLoginError("");
    try {
      const res = await login("admin@ideaipo.com", adminPassInput, "ADMIN");
      if (!res.success) {
        setLoginError(res.message || "Invalid Director password.");
      }
    } catch {
      setLoginError("Network connection error.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center space-y-4 animate-in fade-in duration-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-pulse">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="h-5 w-48 rounded-xl bg-white/10 animate-pulse" />
        <p className="text-xs font-mono text-zinc-500">Verifying event governance credentials...</p>
      </div>
    );
  }

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 px-4 max-w-md mx-auto animate-in fade-in duration-200">
        <div className="w-full rounded-3xl border border-rose-500/30 bg-gradient-to-b from-[#180d14]/95 to-[#060810]/95 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-rose-500/10 space-y-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-[10px] font-mono text-rose-300 font-bold uppercase tracking-wider">
              Restricted Area
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Mission Control Room
            </h1>
            <p className="text-xs font-mono text-zinc-400 leading-relaxed">
              Event governance, circuit breakers, and database overrides are reserved for the Event Director.
            </p>
          </div>

          <form onSubmit={handleDirectorLogin} className="space-y-3.5 text-left">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1 font-semibold">
                Director Passkey
              </label>
              <Input
                type="password"
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
                placeholder="Enter Director password..."
                className="h-11 bg-white/5 border-white/10 font-mono text-sm text-white placeholder:text-zinc-600 rounded-xl focus:border-rose-500/50"
                autoFocus
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs font-mono text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 text-xs font-mono font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-400 hover:to-pink-400 transition-all shadow-md shadow-rose-500/25 active:scale-[0.98] rounded-xl"
            >
              {isVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              {isVerifying ? "Verifying..." : "Unlock Mission Control"}
            </Button>
          </form>

          <div className="pt-2 border-t border-white/10">
            <Link
              href="/teams"
              className="inline-block text-xs font-mono text-zinc-400 hover:text-white transition-colors"
            >
              ← Return to Live Bidding Floor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Leaderboard Computations: Best Team & Best Investor
  const rankedTeams = [...startups].sort((a, b) => {
    if (b.totalInvestmentReceived !== a.totalInvestmentReceived) {
      return b.totalInvestmentReceived - a.totalInvestmentReceived;
    }
    const valA = (a.totalShares || 1000000) * (a.currentPrice || 100);
    const valB = (b.totalShares || 1000000) * (b.currentPrice || 100);
    return valB - valA;
  });
  const bestTeam = rankedTeams[0] || null;

  const rankedInvestors = [...usersList]
    .filter((u) => u.role === "RETAIL" || u.role === "FII")
    .map((u) => {
      const holdingsValue = (u.holdings || []).reduce((acc, h) => {
        const st = startups.find((s) => s.id === h.startupId);
        const livePrice = st ? st.currentPrice : h.averageBuyPrice;
        return acc + h.quantity * livePrice;
      }, 0);
      const netWorth = u.currentBalance + holdingsValue;
      const profit = netWorth - u.startingCapital;
      const profitPercent = u.startingCapital > 0 ? (profit / u.startingCapital) * 100 : 0;
      const totalSharesHeld = (u.holdings || []).reduce((acc, h) => acc + h.quantity, 0);

      return {
        ...u,
        holdingsValue,
        netWorth,
        profit,
        profitPercent,
        totalSharesHeld,
      };
    })
    .sort((a, b) => {
      if (b.profit !== a.profit) {
        return b.profit - a.profit;
      }
      return b.netWorth - a.netWorth;
    });

  const bestInvestor = rankedInvestors[0] || null;

  return (
    <div className="space-y-6 pb-16">
      {/* Action Toast / Feedback Bar */}
      {actionFeedback && (
        <div className="sticky top-20 z-50 rounded-xl border border-cyan-500/40 bg-cyan-950/90 p-3 text-center text-xs font-mono font-bold text-cyan-300 shadow-xl backdrop-blur-xl animate-fade-in">
          ⚡ {actionFeedback}
        </div>
      )}

      {/* Admin Privilege Authorization Banner (if not logged in as Admin) */}
      {(!user || user.role !== "ADMIN") && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-amber-500/10 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Event Director Authorization Required</h3>
              <p className="text-xs text-zinc-300">
                You are currently viewing as <strong className="text-amber-400">{user ? `${getUserDisplayIdentifier(user)} (${user.role})` : "Guest / Not Signed In"}</strong>. Sign in as Event Director to issue live market controls and stage governance.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              setAdminAuthError("");
              setAdminModalPassword("");
              setAdminAuthModalOpen(true);
            }}
            className="w-full sm:w-auto font-mono text-xs font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-400 hover:to-pink-400 shrink-0 shadow-md shadow-rose-500/25 active:scale-95"
          >
            <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Sign In as Director
          </Button>
        </div>
      )}

      {/* Director Password Verification Dialog */}
      <Dialog open={adminAuthModalOpen} onOpenChange={setAdminAuthModalOpen}>
        <DialogContent className="max-w-md border border-rose-500/30 bg-[#0e1424] text-white">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="h-4 w-4" />
              Director Mission Control
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              Authorize Director Privileges
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-mono">
              Enter master Director password to activate market controls, emergency breaker, and stage transitions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDirectorAuthenticate} className="space-y-4 pt-2">
            {adminAuthError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-2.5 text-xs text-rose-200 flex items-center gap-2 font-mono">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{adminAuthError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-mono text-zinc-300 font-semibold">
                Director Password
              </label>
              <div className="relative">
                <Input
                  type={showAdminModalPass ? "text" : "password"}
                  placeholder="Enter director password..."
                  value={adminModalPassword}
                  onChange={(e) => {
                    setAdminModalPassword(e.target.value);
                    if (adminAuthError) setAdminAuthError("");
                  }}
                  className="h-11 text-xs text-white placeholder:text-zinc-500 font-mono rounded-xl pl-9 pr-10 border-white/20 bg-black/60 focus-visible:ring-rose-500/50"
                  required
                  autoFocus
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <button
                  type="button"
                  onClick={() => setShowAdminModalPass(!showAdminModalPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  title={showAdminModalPass ? "Hide password" : "Show password"}
                >
                  {showAdminModalPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdminAuthModalOpen(false)}
                className="w-full sm:w-auto text-xs font-mono border-white/15 text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUnlockingAdmin || !adminModalPassword}
                className="w-full sm:w-auto text-xs font-mono font-bold bg-gradient-to-r from-rose-500 to-pink-500 text-white hover:from-rose-400 hover:to-pink-400 shadow-md shadow-rose-500/25"
              >
                {isUnlockingAdmin ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Unlock className="h-3.5 w-3.5" /> Unlock Governance
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Mission Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-rose-400 uppercase tracking-widest mb-1">
            <ShieldCheck className="h-4 w-4" />
            Event Director Cockpit • Full Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Mission Control Room
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Emergency market circuit breaker, state transitions, participant capital adjustments, and award certification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleResetDemo}
            variant="outline"
            size="sm"
            className="border-white/20 text-xs font-mono text-zinc-300 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1 text-amber-400" /> Reset Demo DB
          </Button>

          {/* Master Emergency Circuit Breaker Button */}
          <Button
            onClick={handleToggleFreeze}
            className={`font-mono text-xs font-black tracking-wide gap-1.5 shadow-lg ${
              marketState?.isMarketActive
                ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20"
                : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20"
            }`}
          >
            {marketState?.isMarketActive ? (
              <>
                <ShieldAlert className="h-4 w-4" /> FREEZE MARKET
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> RESUME MARKET
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Ticker Announcement Strip Editor */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <Radio className="h-4 w-4 text-cyan-400 shrink-0" />
          <Input
            value={bannerInput}
            onChange={(e) => setBannerInput(e.target.value)}
            placeholder="Broadcast announcement ticker (displays on all client terminals)..."
            className="text-xs font-mono bg-black/40"
          />
          <Button
            onClick={handleUpdateBanner}
            size="sm"
            className="text-xs font-mono shrink-0 bg-cyan-500 text-black hover:bg-cyan-400 font-bold"
          >
            Broadcast
          </Button>
        </CardContent>
      </Card>

      {/* Six Dedicated Consoles via Tabs with Mobile Horizontal Scrolling */}
      <Tabs defaultValue="control-room">
        <div className="overflow-x-auto no-scrollbar pb-1">
          <TabsList className="mb-4 w-max flex-nowrap">
            <TabsTrigger value="control-room" className="gap-1.5 font-mono text-xs">
              <Radio className="h-3.5 w-3.5" /> 1. Control Room
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-1.5 font-mono text-xs text-emerald-400 font-bold border border-emerald-500/30 data-[state=active]:bg-emerald-500 data-[state=active]:text-black">
              <Layers className="h-3.5 w-3.5" /> 2. Register Teams ({startups.length})
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-1.5 font-mono text-xs text-amber-300 font-bold border border-amber-500/40 data-[state=active]:bg-amber-400 data-[state=active]:text-black">
              <Trophy className="h-3.5 w-3.5" /> 3. Leaderboard
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 font-mono text-xs">
              <Users className="h-3.5 w-3.5" /> 4. Users ({usersList.length})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 font-mono text-xs">
              <CreditCard className="h-3.5 w-3.5" /> 5. Transactions ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="override" className="gap-1.5 font-mono text-xs">
              <Sliders className="h-3.5 w-3.5" /> 6. Override
            </TabsTrigger>
            <TabsTrigger value="audit-logs" className="gap-1.5 font-mono text-xs">
              <History className="h-3.5 w-3.5" /> 7. Audit Logs
            </TabsTrigger>
            <TabsTrigger value="awards" className="gap-1.5 font-mono text-xs">
              <Award className="h-3.5 w-3.5" /> 8. Awards Ceremony
            </TabsTrigger>
            <TabsTrigger value="exchange" className="gap-1.5 font-mono text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> 9. Stock Exchange
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. CONTROL ROOM CONSOLE */}
        <TabsContent value="control-room">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Live Stage Conductor & State Machine</CardTitle>
              <CardDescription className="text-xs">
                Control the 9-state IPO lifecycle for each venture on stage. Only IPO LIVE accepts bids.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-4">
                {startups.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                    <Layers className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-sm font-mono text-zinc-300 font-semibold">No startup ventures registered yet.</p>
                    <p className="text-xs font-mono text-zinc-500 mt-1">Switch to the &quot;2. Register Teams&quot; tab to register pitching teams.</p>
                  </div>
                ) : (
                  startups.map((s) => {
                  const isOpen = s.ipoStatus === "IPO_OPEN";
                  const isPaused = s.ipoStatus === "IPO_PAUSED";
                  const isClosed = s.ipoStatus === "IPO_CLOSED";

                  return (
                    <div
                      key={s.id}
                      className={`rounded-2xl border p-4 sm:p-5 transition-all space-y-4 ${
                        isOpen
                          ? "border-emerald-500/40 bg-emerald-500/[0.04] shadow-[0_0_20px_rgba(0,229,153,0.06)]"
                          : isPaused
                          ? "border-amber-500/40 bg-amber-500/[0.04]"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      {/* Top Info Strip */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                              Pitch #{s.pitchOrder}
                            </span>
                            <h4 className="font-bold text-white text-base sm:text-lg">{s.name}</h4>
                            <span className="text-xs font-mono text-cyan-400 font-semibold">({s.industry})</span>
                            <StatusBadge status={s.ipoStatus} />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400">
                            <span>Ask: <strong className="text-white">{formatINR(s.fundingAsk)}</strong></span>
                            <span>•</span>
                            <span>Raised: <strong className="text-emerald-400 font-bold">{formatINR(s.totalInvestmentReceived)}</strong></span>
                            <span>•</span>
                            <span>Live Price: <strong className="text-cyan-300 font-bold">{formatSharePrice(s.currentPrice || 100)}</strong></span>
                            <span>•</span>
                            <span>{s.investorCount} bids</span>
                          </div>
                        </div>

                        {/* Primary Quick Controls */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isOpen || transitioningStartupId?.startsWith(s.id)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(s.id, "IPO_OPEN");
                            }}
                            className={`font-mono text-xs font-bold gap-1.5 h-9 px-3.5 transition-all active:scale-95 ${
                              isOpen
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default opacity-90"
                                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20"
                            }`}
                          >
                            {transitioningStartupId === `${s.id}-IPO_OPEN` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                            {isOpen ? "IPO IS LIVE" : "OPEN IPO"}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            disabled={isPaused || transitioningStartupId?.startsWith(s.id)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(s.id, "IPO_PAUSED");
                            }}
                            className={`font-mono text-xs font-bold gap-1.5 h-9 px-3.5 transition-all active:scale-95 ${
                              isPaused
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default opacity-90"
                                : "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20"
                            }`}
                          >
                            {transitioningStartupId === `${s.id}-IPO_PAUSED` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Pause className="h-3.5 w-3.5 fill-current" />
                            )}
                            {isPaused ? "PAUSED" : "PAUSE"}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            disabled={isClosed || transitioningStartupId?.startsWith(s.id)}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(s.id, "IPO_CLOSED");
                            }}
                            className={`font-mono text-xs font-bold gap-1.5 h-9 px-3.5 transition-all active:scale-95 ${
                              isClosed
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-default opacity-90"
                                : "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20"
                            }`}
                          >
                            {transitioningStartupId === `${s.id}-IPO_CLOSED` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Square className="h-3 w-3 fill-current" />
                            )}
                            {isClosed ? "CLOSED" : "CLOSE"}
                          </Button>
                        </div>
                      </div>

                      {/* Complete Stage State Machine Bar */}
                      <div>
                        <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold mb-1.5">
                          Set Lifecycle Stage:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ALL_STATES.map((st) => {
                            const isCurrent = s.ipoStatus === st;
                            const isTransitioning = transitioningStartupId === `${s.id}-${st}`;

                            return (
                              <button
                                key={st}
                                type="button"
                                disabled={transitioningStartupId?.startsWith(s.id)}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleStatusChange(s.id, st);
                                }}
                                className={`rounded-xl border px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                                  isCurrent
                                    ? "border-emerald-500 bg-emerald-500/25 text-emerald-300 shadow-[0_0_12px_rgba(0,229,153,0.3)] ring-1 ring-emerald-500/50"
                                    : "border-white/10 bg-white/5 text-zinc-300 hover:border-cyan-500/40 hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                {isTransitioning ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                                ) : isCurrent ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                ) : null}
                                <span>{st.replace("_", " ")}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. REGISTER TEAMS & PITCH ROSTER */}
        <TabsContent value="teams">
          <Card className="border-white/10 bg-white/[0.02]">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-6">
              <div>
                <CardTitle className="text-xl font-black text-white flex items-center gap-2.5">
                  <Layers className="h-5 w-5 text-emerald-400" />
                  Startup Teams Registration & Pitch Roster
                  <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    {startups.length} Registered
                  </span>
                </CardTitle>
                <CardDescription className="text-xs font-mono text-zinc-400 mt-1 max-w-2xl">
                  Register official venture teams with their required Ask (₹), Share Value (₹), Pitch Idea, and Equity. Registered teams are instantly broadcasted across the Pitches page (/teams), Stock Exchange, and Investor Terminals.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={() => {
                    setTeamPitchOrder(startups.length + 1);
                    setRegisterTeamError("");
                    setRegisterTeamModalOpen(true);
                  }}
                  className="font-mono text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-500/20 gap-1.5 h-10 px-4"
                >
                  <Plus className="h-4 w-4" />
                  Register New Team
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setClearTrialsModalOpen(true)}
                  className="font-mono text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 gap-1.5 h-10 px-3.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Purge All Teams / Reset
                </Button>

                <Button
                  variant="outline"
                  onClick={refreshAllAdminData}
                  className="font-mono text-xs border-white/15 text-zinc-300 hover:text-white gap-1.5 h-10 px-3"
                  title="Refresh Teams List"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {startups.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-inner">
                    <Layers className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1.5">No Startup Teams Registered Yet</h3>
                  <p className="text-xs font-mono text-zinc-400 max-w-md mx-auto mb-6">
                    The exchange is currently clean with 0 trial teams. Click below to register your first official pitch team with their required ask, share value, and pitch idea.
                  </p>
                  <Button
                    onClick={() => {
                      setTeamPitchOrder(1);
                      setRegisterTeamError("");
                      setRegisterTeamModalOpen(true);
                    }}
                    className="font-mono text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-500/20 gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Register Pitch #1 Team
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {startups.map((s) => {
                    const isOpen = s.ipoStatus === "IPO_OPEN";
                    return (
                      <div
                        key={s.id}
                        className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                          isOpen
                            ? "border-emerald-500/40 bg-emerald-500/[0.03] shadow-[0_0_25px_rgba(0,229,153,0.05)]"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div>
                          {/* Card Top Row */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="font-mono text-[11px] font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">
                                  Pitch #{s.pitchOrder}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                                  {s.industry}
                                </span>
                                <StatusBadge status={s.ipoStatus} />
                              </div>
                              <h3 className="text-xl font-bold text-white">{s.name}</h3>
                              <p className="text-xs text-zinc-300 mt-1 line-clamp-1 italic">
                                &quot;{s.tagLine}&quot;
                              </p>
                            </div>

                            <Link
                              href={`/startup/${s.slug}`}
                              target="_blank"
                              className="p-2 rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
                              title="Open Terminal"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>

                          {/* Idea / Summary Box */}
                          <div className="rounded-xl border border-white/5 bg-black/30 p-3 mb-4">
                            <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold mb-1">
                              Pitch Idea & Innovation:
                            </span>
                            <p className="text-xs font-mono text-zinc-200 line-clamp-3">
                              {s.pitchSummary || s.problem || "No description provided."}
                            </p>
                          </div>

                          {/* Financials Metric Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Funding Ask</span>
                              <span className="text-sm font-mono font-bold text-white">{formatINR(s.fundingAsk)}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Share Value (LTP)</span>
                              <span className="text-sm font-mono font-bold text-emerald-400">{formatSharePrice(s.currentPrice || 100)}</span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Valuation</span>
                              <span className="text-sm font-mono font-bold text-cyan-300">
                                {formatINR(s.initialValuation || s.fundingAsk * 10)}
                              </span>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Raised</span>
                              <span className="text-sm font-mono font-bold text-teal-300">
                                {formatINR(s.totalInvestmentReceived)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Bottom Actions */}
                        <div className="border-t border-white/[0.06] pt-3.5 flex flex-wrap items-center justify-between gap-2 mt-auto">
                          {/* Status quick switcher */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-zinc-400 mr-1">Status:</span>
                            <select
                              value={s.ipoStatus}
                              disabled={transitioningStartupId?.startsWith(s.id)}
                              onChange={(e) => handleStatusChange(s.id, e.target.value as IPOStatus)}
                              className="h-8 rounded-lg border border-white/10 bg-black/60 px-2 text-xs font-mono text-white outline-none focus:border-cyan-500"
                            >
                              <option value="IPO_OPEN">IPO LIVE (Trading Open)</option>
                              <option value="PITCHING">PITCHING (On Stage)</option>
                              <option value="COMING_UP">COMING UP (Roster)</option>
                              <option value="IPO_PAUSED">IPO PAUSED</option>
                              <option value="IPO_CLOSED">IPO CLOSED</option>
                            </select>
                          </div>

                          {/* Delete button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteStartupConfirmId(s.id)}
                            className="h-8 px-2.5 rounded-lg border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-mono text-xs gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. LEADERBOARD CONSOLE: BEST TEAM & BEST INVESTOR */}
        <TabsContent value="leaderboard">
          <div className="space-y-6">
            {/* Top Header Card */}
            <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-white flex items-center gap-2.5">
                    <Trophy className="h-6 w-6 text-amber-400" />
                    Auditorium Live Leaderboard & Hall of Fame
                  </CardTitle>
                  <CardDescription className="text-xs font-mono text-zinc-300 mt-1 max-w-2xl">
                    Live rankings celebrating the <strong className="text-amber-300">#1 Best Venture Team</strong> leading the stage and the <strong className="text-emerald-300">#1 Best Investor</strong> with the highest portfolio gains.
                  </CardDescription>
                </div>

                <Button
                  variant="outline"
                  onClick={refreshAllAdminData}
                  className="font-mono text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 gap-1.5 h-9"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Live Refresh
                </Button>
              </CardHeader>
            </Card>

            {/* Champion Spotlights: 2 Large Cards Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: BEST TEAM TILL NOW */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-b from-[#1c1608]/90 via-[#120f07]/90 to-[#080703]/90 p-6 sm:p-7 shadow-[0_0_35px_rgba(245,158,11,0.12)] flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
                
                <div>
                  {/* Badge */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm">
                      <Trophy className="h-3.5 w-3.5 text-amber-400" /> 🥇 BEST TEAM TILL NOW
                    </span>
                    {bestTeam && (
                      <span className="font-mono text-xs font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-lg">
                        Pitch #{bestTeam.pitchOrder}
                      </span>
                    )}
                  </div>

                  {bestTeam ? (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {bestTeam.name}
                          </h3>
                          <StatusBadge status={bestTeam.ipoStatus} />
                        </div>
                        <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider block">
                          {bestTeam.industry}
                        </span>
                        <p className="text-xs text-zinc-300 mt-2 line-clamp-2 italic">
                          &quot;{bestTeam.tagLine}&quot;
                        </p>
                      </div>

                      {/* 4 Financial Metric Boxes */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Total Capital Raised</span>
                          <span className="text-xl font-mono font-black text-amber-300">
                            {formatINR(bestTeam.totalInvestmentReceived)}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 block mt-0.5 font-bold">
                            {((bestTeam.totalInvestmentReceived / (bestTeam.fundingAsk || 1)) * 100).toFixed(1)}% Subscribed
                          </span>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Live Share Price (LTP)</span>
                          <span className="text-xl font-mono font-black text-white">
                            {formatSharePrice(bestTeam.currentPrice)}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-300 block mt-0.5 font-bold">
                            {bestTeam.currentPrice >= (bestTeam.openPrice || 100) ? "+" : ""}
                            {(((bestTeam.currentPrice - (bestTeam.openPrice || 100)) / (bestTeam.openPrice || 100)) * 100).toFixed(2)}% vs Open
                          </span>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Market Valuation</span>
                          <span className="text-base font-mono font-bold text-white">
                            {formatINR((bestTeam.totalShares || 1000000) * bestTeam.currentPrice)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            Ask: {formatINR(bestTeam.fundingAsk)}
                          </span>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Audience Engagement</span>
                          <span className="text-base font-mono font-bold text-white">
                            {bestTeam.investorCount} Bids
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            {bestTeam.totalVolume.toLocaleString()} shares traded
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-white/10 text-zinc-400 font-mono text-xs">
                      No startup teams registered yet. Register teams in Tab 2 to determine the stage champion.
                    </div>
                  )}
                </div>

                {bestTeam && (
                  <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-zinc-400">#1 by Capital Raised & Valuation</span>
                    <Link
                      href={`/startup/${bestTeam.slug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl font-mono text-xs font-bold bg-amber-400 text-black hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20"
                    >
                      <span>Open Team Terminal</span> <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Card 2: BEST INVESTOR TILL NOW */}
              <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-[#061814]/90 via-[#04100d]/90 to-[#020806]/90 p-6 sm:p-7 shadow-[0_0_35px_rgba(0,229,153,0.12)] flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 shadow-[0_0_15px_rgba(0,229,153,0.8)]" />

                <div>
                  {/* Badge */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm">
                      <Crown className="h-3.5 w-3.5 text-emerald-400" /> 👑 BEST INVESTOR TILL NOW
                    </span>
                    {bestInvestor && (
                      <span className={`font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                        bestInvestor.role === "FII"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      }`}>
                        {bestInvestor.role === "FII" ? "Institutional Judge (FII)" : "Audience Retail"}
                      </span>
                    )}
                  </div>

                  {bestInvestor ? (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                            {bestInvestor.name}
                          </h3>
                          {bestInvestor.token && (
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black/60 border border-emerald-500/40 text-emerald-300">
                              Passkey: {bestInvestor.token}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-zinc-400 block">
                          {bestInvestor.email}
                        </span>
                      </div>

                      {/* 4 Financial Metric Boxes */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Net Portfolio Worth</span>
                          <span className="text-xl font-mono font-black text-emerald-400">
                            {formatINR(bestInvestor.netWorth)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            Cash: {formatINR(bestInvestor.currentBalance)}
                          </span>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Net Profit / Alpha</span>
                          <span className={`text-xl font-mono font-black ${bestInvestor.profit >= 0 ? "text-cyan-300" : "text-rose-400"}`}>
                            {bestInvestor.profit >= 0 ? "+" : ""}{formatINR(bestInvestor.profit)}
                          </span>
                          <span className={`text-[10px] font-mono block mt-0.5 font-bold ${bestInvestor.profitPercent >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                            {bestInvestor.profitPercent >= 0 ? "+" : ""}{bestInvestor.profitPercent.toFixed(2)}% ROI
                          </span>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Equity Holdings</span>
                          <span className="text-base font-mono font-bold text-white">
                            {formatINR(bestInvestor.holdingsValue)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            {bestInvestor.totalSharesHeld.toLocaleString()} shares held
                          </span>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                          <span className="block text-[10px] font-mono text-zinc-400 uppercase font-semibold">Starting Capital</span>
                          <span className="text-base font-mono font-bold text-white">
                            {formatINR(bestInvestor.startingCapital)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                            Deployed: {formatINR(bestInvestor.totalInvested)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-white/10 text-zinc-400 font-mono text-xs">
                      No investor accounts registered yet.
                    </div>
                  )}
                </div>

                {bestInvestor && (
                  <div className="pt-3 border-t border-emerald-500/20 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-zinc-400">#1 by Portfolio Wealth & Profit</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustUser(bestInvestor);
                        setNewCapital(bestInvestor.startingCapital);
                        setAdjustReason("");
                      }}
                      className="font-mono text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 h-9"
                    >
                      Adjust Allocation
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Two Ranked Tables */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
              {/* Table 1: All Teams Ranked */}
              <Card className="border-white/10 bg-white/[0.02]">
                <CardHeader className="pb-3 border-b border-white/[0.06]">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Medal className="h-4 w-4 text-amber-400" />
                    All Pitch Teams Ranked ({rankedTeams.length})
                  </CardTitle>
                  <CardDescription className="text-xs font-mono text-zinc-400">
                    Ranked by total capital raised, share price, and subscriber multiple.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {rankedTeams.length === 0 ? (
                    <div className="py-8 text-center text-xs font-mono text-zinc-500">
                      No startup teams registered.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="w-12">Rank</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>Raised</TableHead>
                            <TableHead>LTP</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankedTeams.map((t, idx) => (
                            <TableRow key={t.id} className="border-white/5 hover:bg-white/[0.02]">
                              <TableCell className="font-mono font-bold text-xs">
                                {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `#${idx + 1}`}
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-white text-xs block">{t.name}</span>
                                <span className="text-[10px] font-mono text-cyan-400">{t.industry}</span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <span className="text-emerald-400 font-bold block">{formatINR(t.totalInvestmentReceived)}</span>
                                <span className="text-[10px] text-zinc-500">Ask: {formatINR(t.fundingAsk)}</span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <span className="text-white font-bold block">{formatSharePrice(t.currentPrice)}</span>
                                <span className="text-[10px] text-zinc-400">Pitch #{t.pitchOrder}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Link
                                  href={`/startup/${t.slug}`}
                                  target="_blank"
                                  className="inline-flex items-center text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300"
                                >
                                  View ↗
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Table 2: Top 10 Investors Ranked */}
              <Card className="border-white/10 bg-white/[0.02]">
                <CardHeader className="pb-3 border-b border-white/[0.06]">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Crown className="h-4 w-4 text-emerald-400" />
                    Top Performing Investors (Top 10)
                  </CardTitle>
                  <CardDescription className="text-xs font-mono text-zinc-400">
                    Ranked by net profit and total portfolio wealth across audience and judges.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {rankedInvestors.length === 0 ? (
                    <div className="py-8 text-center text-xs font-mono text-zinc-500">
                      No investors registered.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10">
                            <TableHead className="w-12">Rank</TableHead>
                            <TableHead>Investor</TableHead>
                            <TableHead>Net Worth</TableHead>
                            <TableHead>Profit / ROI</TableHead>
                            <TableHead className="text-right">Passkey</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankedInvestors.slice(0, 10).map((inv, idx) => (
                            <TableRow key={inv.id} className="border-white/5 hover:bg-white/[0.02]">
                              <TableCell className="font-mono font-bold text-xs">
                                {idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `#${idx + 1}`}
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-white text-xs block">{inv.name}</span>
                                <span className="text-[10px] font-mono text-zinc-400">{inv.role}</span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <span className="text-emerald-400 font-bold block">{formatINR(inv.netWorth)}</span>
                                <span className="text-[10px] text-zinc-500">Cash: {formatINR(inv.currentBalance)}</span>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                <span className={`font-bold block ${inv.profit >= 0 ? "text-cyan-300" : "text-rose-400"}`}>
                                  {inv.profit >= 0 ? "+" : ""}{formatINR(inv.profit)}
                                </span>
                                <span className={`text-[10px] ${inv.profitPercent >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                                  {inv.profitPercent >= 0 ? "+" : ""}{inv.profitPercent.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold text-amber-300">
                                {inv.token || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 4. USERS CONSOLE */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span>Participant Directory & Presence</span>
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {usersList.length} Accounts
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Inspect liquid balances, presence heartbeats, adjust capital allocations, or search all 150+ audience passkey tokens.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/Audience_Tokens_List.xlsx"
                  download="Audience_Tokens_List.xlsx"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors shadow-sm"
                  title="Download all audience passkey tokens in Excel format"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Tokens .xlsx</span>
                </a>
                <a
                  href="/Audience_Tokens_List.csv"
                  download="Audience_Tokens_List.csv"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                  title="Download all audience passkey tokens as CSV"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>CSV</span>
                </a>
                <Button
                  onClick={() => {
                    setNewUserError("");
                    setNewUserToken(generateRandomToken());
                    setCreateUserModalOpen(true);
                  }}
                  className="font-mono text-xs font-bold gap-1.5 bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  <UserPlus className="h-4 w-4" /> Create Account
                </Button>
              </div>
            </CardHeader>

            {/* Filter and Search Bar */}
            <div className="px-6 pb-4 pt-1 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-zinc-800/80 mb-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search token #, name, or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                {userSearchTerm && (
                  <button
                    onClick={() => setUserSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 text-[11px] font-mono overflow-x-auto pb-1 sm:pb-0">
                {(["ALL", "RETAIL", "FII", "STARTUP", "ADMIN"] as const).map((role) => {
                  const count = role === "ALL" ? usersList.length : usersList.filter((u) => u.role === role).length;
                  const isActive = userRoleFilter === role;
                  return (
                    <button
                      key={role}
                      onClick={() => setUserRoleFilter(role)}
                      className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                          : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                      }`}
                    >
                      {role === "RETAIL" ? "AUDIENCE" : role} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User / Firm</TableHead>
                    <TableHead className="font-mono text-amber-300">Login Token</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Starting Capital</TableHead>
                    <TableHead>Available Balance</TableHead>
                    <TableHead>Total Invested</TableHead>
                    <TableHead>Presence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList
                    .filter((u) => {
                      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
                      if (!userSearchTerm.trim()) return true;
                      const term = userSearchTerm.toLowerCase().trim();
                      const token = (u.token || getUserLoginToken(u) || "").toLowerCase();
                      const name = (u.name || "").toLowerCase();
                      const email = (u.email || "").toLowerCase();
                      return token.includes(term) || name.includes(term) || email.includes(term);
                    })
                    .map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-white">
                        <div>{u.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500">ID: {u.id.slice(0, 14)}</div>
                      </TableCell>
                      <TableCell>
                        {u.role === "ADMIN" ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                            <ShieldCheck className="h-3.5 w-3.5 text-rose-400" />
                            <span>Pass: Bhavishy@2007</span>
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap shadow-sm">
                            <Ticket className="h-3.5 w-3.5 text-amber-400" />
                            <span>Token: {u.token || getUserLoginToken(u)}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-cyan-400">
                        {u.role}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          }`}
                        >
                          {u.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-white">
                        {formatINR(u.startingCapital)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-emerald-400">
                        {formatINR(u.currentBalance)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-300">
                        {formatINR(u.totalInvested)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                            u.isOnline ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              u.isOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                            }`}
                          />
                          {u.isOnline ? "Online" : "Offline"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setAdjustUser(u);
                            setNewCapital(u.startingCapital);
                            setAdjustReason("");
                          }}
                          className="text-[11px] font-mono h-7 px-2"
                        >
                          Adjust Capital
                        </Button>
                        <Button
                          size="sm"
                          variant={u.status === "ACTIVE" ? "destructive" : "secondary"}
                          onClick={() => handleToggleUserStatus(u)}
                          className="text-[11px] font-mono h-7 px-2"
                        >
                          {u.status === "ACTIVE" ? "Block" : "Unblock"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. TRANSACTIONS CONSOLE */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Transaction Ledger & Cancellation</CardTitle>
              <CardDescription className="text-xs">
                Inspect individual bids. Cancelling an order restores funds to user balance and decrements startup total.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tx ID</TableHead>
                    <TableHead>Investor</TableHead>
                    <TableHead>Startup</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs font-bold text-cyan-400">
                        {t.id}
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        {t.investorName} <span className="text-[10px] text-zinc-500">({t.investorType})</span>
                      </TableCell>
                      <TableCell className="text-zinc-200">{t.startupName || "Startup"}</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-400">
                        {formatINR(t.amount)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border ${
                            t.status === "VALID"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          }`}
                        >
                          {t.status}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-400">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.status === "VALID" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleTransactionAction(t.id, "CANCEL")}
                            className="text-[11px] font-mono h-7 px-2"
                          >
                            Cancel & Refund
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTransactionAction(t.id, "RESTORE")}
                            className="text-[11px] font-mono h-7 px-2 border-emerald-500/40 text-emerald-400"
                          >
                            Restore
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. OVERRIDE CONSOLE */}
        <TabsContent value="override">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Manual Startup Valuation Override</CardTitle>
              <CardDescription className="text-xs">
                Directly adjust a startup&apos;s total funds raised with mandatory justification (min 5 chars).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 max-w-xl">
              <form onSubmit={handleOverrideSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">Select Target Startup</label>
                  <select
                    value={overrideStartupId}
                    onChange={(e) => setOverrideStartupId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs text-white outline-none"
                    required
                  >
                    <option value="" className="bg-zinc-900">
                      -- Choose Startup --
                    </option>
                    {startups.map((s) => (
                      <option key={s.id} value={s.id} className="bg-zinc-900">
                        {s.name} (Current: {formatINR(s.totalInvestmentReceived)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">New Total Investment (₹ INR)</label>
                  <Input
                    type="number"
                    min={0}
                    value={overrideNewTotal}
                    onChange={(e) => setOverrideNewTotal(Number(e.target.value))}
                    required
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-zinc-300">
                    Mandatory Justification (minimum 5 characters)
                  </label>
                  <Input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Offline jury stage score bonus correction"
                    required
                    minLength={5}
                    className="font-mono text-xs"
                  />
                </div>

                <Button type="submit" className="font-mono text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400">
                  Submit Valuation Override
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. AUDIT LOGS CONSOLE */}
        <TabsContent value="audit-logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Compliance Audit Ledger</CardTitle>
              <CardDescription className="text-xs">
                Immutable trace of all administrative operations, overrides, and market freezes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-zinc-400 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-semibold text-white">{log.adminName}</TableCell>
                      <TableCell className="font-mono text-xs text-amber-400 font-bold">
                        {log.action}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-cyan-400">
                        {log.targetType}: {log.targetId}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-300 max-w-md truncate">
                        {log.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. AWARDS CEREMONY CONSOLE */}
        <TabsContent value="awards">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Awards Ceremony Certification</CardTitle>
              <CardDescription className="text-xs">
                Algorithmic recommendation engine and official certification lock for stage presentation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {awardsData?.awards.map((aw) => {
                  const rec = awardsData.recommendations[aw.awardKey];

                  return (
                    <div
                      key={aw.awardKey}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Trophy className="h-4 w-4" /> {aw.awardName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border ${
                            aw.confirmedByAdmin
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {aw.confirmedByAdmin ? "CERTIFIED" : "PENDING"}
                        </span>
                      </div>

                      {/* Recommendation suggestion */}
                      {rec && (
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 text-xs font-mono text-cyan-300">
                          <span className="text-[10px] block uppercase text-zinc-400">
                            Algorithmic Leader:
                          </span>
                          <span className="font-bold">{rec.startupName}</span> ({rec.metric})
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <select
                          id={`select-${aw.awardKey}`}
                          defaultValue={aw.startupId || rec?.startupId || ""}
                          className="flex-1 rounded-xl border border-white/10 bg-black/40 p-2 text-xs font-mono text-white outline-none"
                        >
                          {startups.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>

                        <Button
                          size="sm"
                          onClick={() => {
                            const sel = document.getElementById(
                              `select-${aw.awardKey}`
                            ) as HTMLSelectElement;
                            const chosen = sel?.value || aw.startupId || rec?.startupId || startups[0]?.id;
                            if (chosen) {
                              handleConfirmAward(aw.awardKey, chosen);
                            } else {
                              flashMessage("Please select a startup first.");
                            }
                          }}
                          className="font-mono text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 shrink-0"
                        >
                          Certify Winner
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. STOCK EXCHANGE CONSOLE */}
        <TabsContent value="exchange">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Stock Exchange Governance & Order Book Controls
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage two-sided market liquidity, halt or resume equity quotes, and inspect live trading depth.
                </CardDescription>
              </div>
              <Button
                onClick={() => handleInjectLiquidity()}
                className="font-mono text-xs font-bold bg-cyan-500 text-black hover:bg-cyan-400 gap-1.5"
                size="sm"
              >
                <Zap className="h-3.5 w-3.5" /> Re-Seed Market Liquidity
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stock / Company</TableHead>
                      <TableHead>Last Traded Price</TableHead>
                      <TableHead>24h Range</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Market Cap</TableHead>
                      <TableHead>Trading Status</TableHead>
                      <TableHead className="text-right">Exchange Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {startups.map((s) => {
                      const isSuspended = (s as any).isSuspended || false;
                      const ltp = s.currentPrice || 100;
                      const dayHigh = (s as any).dayHigh || ltp;
                      const dayLow = (s as any).dayLow || ltp;
                      const vol = (s as any).totalVolume || 0;
                      const mcap = (s as any).totalShares ? (s as any).totalShares * ltp : ltp * 1000000;

                      return (
                        <TableRow key={s.id} className="border-white/5 hover:bg-white/[0.02]">
                          <TableCell>
                            <div>
                              <a
                                href={`/startup/${s.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-bold text-white hover:text-cyan-300 flex items-center gap-1.5"
                              >
                                {s.name}
                                <span className="text-[10px] font-mono text-zinc-500">↗</span>
                              </a>
                              <span className="text-[11px] font-mono text-zinc-400">{s.industry}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-white text-sm">
                            {formatSharePrice(ltp)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-300">
                            H: {formatSharePrice(dayHigh)} • L: {formatSharePrice(dayLow)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-white">
                            {vol.toLocaleString()} shares
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-300">
                            {formatINR(mcap)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                                isSuspended
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              }`}
                            >
                              {isSuspended ? "SUSPENDED" : "ACTIVE"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleInjectLiquidity(s.id)}
                                className="h-8 px-2.5 rounded-lg font-mono text-xs border-white/10 text-zinc-300 hover:text-white"
                              >
                                Inject Quotes
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleSuspend(s.id, isSuspended)}
                                className={`h-8 px-2.5 rounded-lg font-mono text-xs font-bold border ${
                                  isSuspended
                                    ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                    : "border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                                }`}
                              >
                                {isSuspended ? "Resume" : "Halt"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Capital Adjustment Dialog */}
      <Dialog open={!!adjustUser} onOpenChange={(open) => !open && setAdjustUser(null)}>
        <DialogContent className="sm:max-w-md">
          {adjustUser && (
            <>
              <DialogHeader>
                <DialogTitle>Adjust User Capital</DialogTitle>
                <DialogDescription>
                  Modify nominal capital for {adjustUser.name} ({adjustUser.role}).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs font-mono">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                  <div>Previous Capital: {formatINR(adjustUser.startingCapital)}</div>
                  <div>Previous Balance: {formatINR(adjustUser.currentBalance)}</div>
                  <div className="text-emerald-400 font-bold pt-1 border-t border-white/10">
                    Delta: {formatINR(newCapital - adjustUser.startingCapital)}
                  </div>
                  <div className="text-cyan-400 font-bold">
                    Projected Balance:{" "}
                    {formatINR(
                      Math.max(0, adjustUser.currentBalance + (newCapital - adjustUser.startingCapital))
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300">New Starting Capital (₹ INR)</label>
                  <Input
                    type="number"
                    min={0}
                    step={50000}
                    value={newCapital}
                    onChange={(e) => setNewCapital(Number(e.target.value))}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300">Mandatory Justification</label>
                  <Input
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="e.g. Sponsor top-up for institutional judge"
                    className="font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setAdjustUser(null)} className="font-mono text-xs">
                  Cancel
                </Button>
                <Button
                  onClick={handleAdjustCapitalSubmit}
                  className="font-mono text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400"
                >
                  Confirm Adjustment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Create User Account Dialog */}
      <Dialog open={createUserModalOpen} onOpenChange={setCreateUserModalOpen}>
        <DialogContent className="sm:max-w-lg bg-[#0c101d] border-white/15 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <UserPlus className="h-4 w-4" />
              </div>
              Provision Participant Account
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Create an authorized trading terminal account. Only administrators have privilege to generate credentials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUserSubmit} className="space-y-4 pt-1">
            {newUserError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-300 font-medium">
                {newUserError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Full Name / Entity Name <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Apex Horizon Capital"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="bg-black/50 border-white/15 text-xs text-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Email Identifier <span className="text-rose-400">*</span></span>
                  {newUserRole !== "ADMIN" && newUserToken && (
                    <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
                      Token: {newUserToken}
                    </span>
                  )}
                </label>
                <Input
                  type="email"
                  placeholder="e.g. investor@ideaipo.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="bg-black/50 border-white/15 text-xs text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Terminal Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) =>
                    handleRoleChange(e.target.value as "RETAIL" | "FII" | "STARTUP" | "ADMIN")
                  }
                  className="flex h-9 w-full rounded-md border border-white/15 bg-black/50 px-3 py-1 text-xs font-mono font-semibold text-cyan-300 shadow-sm focus-visible:outline-none"
                >
                  <option value="RETAIL">RETAIL (Audience Investor)</option>
                  <option value="FII">FII (Institutional VC Judge)</option>
                  <option value="STARTUP">STARTUP (Pitching Founder)</option>
                  <option value="ADMIN">ADMIN (Event Director)</option>
                </select>
              </div>

              {newUserRole === "ADMIN" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Master Admin Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Bhavishy@2007"
                      value={newUserPassword || "Bhavishy@2007"}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="bg-black/50 border-white/15 text-xs text-white pr-9 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-300">
                      Assigned 6-Digit Token <span className="text-amber-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewUserToken(generateRandomToken())}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>Randomize</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400" />
                      <Input
                        type="text"
                        maxLength={6}
                        value={newUserToken}
                        onChange={(e) => setNewUserToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="e.g. 849201"
                        className="bg-black/50 border-amber-500/40 text-xs text-amber-300 pl-8 font-mono font-bold tracking-widest"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewUserToken(generateRandomToken())}
                      className="font-mono text-[11px] h-9 px-2.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 gap-1 shrink-0"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Random</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic fields based on role */}
            {(newUserRole === "RETAIL" || newUserRole === "FII") && (
              <div className="space-y-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-300">
                    Starting Capital Allocation (₹ INR)
                  </label>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    {formatINR(newUserCapital)}
                  </span>
                </div>
                <Input
                  type="number"
                  min={0}
                  step={25000}
                  value={newUserCapital}
                  onChange={(e) => setNewUserCapital(Number(e.target.value))}
                  className="bg-black/50 border-white/15 text-xs text-white font-mono"
                  required
                />
                <p className="text-[10px] font-mono text-zinc-500">
                  Default: ₹5,00,000 for Retail, ₹1,00,00,000 for Institutional FII.
                </p>
              </div>
            )}

            {newUserRole === "STARTUP" && (
              <div className="space-y-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                <label className="text-xs font-semibold text-cyan-300">
                  Link with Pitching Venture
                </label>
                <select
                  value={newUserStartupId}
                  onChange={(e) => setNewUserStartupId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-white/15 bg-black/50 px-3 py-1 text-xs font-mono text-white shadow-sm focus-visible:outline-none"
                >
                  <option value="">-- Standalone Founder (No Specific Startup) --</option>
                  {startups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.industry})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-mono text-zinc-500">
                  Allows the founder to view real-time cap table and telemetry for this startup.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">
                Contact Phone <span className="text-[10px] text-zinc-500">(Optional)</span>
              </label>
              <Input
                type="tel"
                placeholder="+91 98765 43210"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
                className="bg-black/50 border-white/15 text-xs text-white font-mono"
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateUserModalOpen(false)}
                className="font-mono text-xs border-white/20 text-zinc-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingUser}
                className="font-mono text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 gap-1.5"
              >
                {isCreatingUser ? (
                  "Provisioning..."
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirm & Provision Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REGISTER STARTUP TEAM MODAL */}
      <Dialog open={registerTeamModalOpen} onOpenChange={setRegisterTeamModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0a0f1d]/95 border-white/15 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-400" />
              Register New Startup Team & Pitch
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-mono text-xs">
              Configure team details, financial valuation, and stage status. Once submitted, this startup is instantly live across all audience devices and exchange boards.
            </DialogDescription>
          </DialogHeader>

          {registerTeamError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{registerTeamError}</span>
            </div>
          )}

          <form onSubmit={handleRegisterTeam} className="space-y-4 my-2">
            {/* Row 1: Name and Pitch Order */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                  Team / Startup Name <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. EcoVolt Motors, FinPay AI"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="bg-black/50 border-white/15 text-xs text-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Pitch Order <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  value={teamPitchOrder}
                  onChange={(e) => setTeamPitchOrder(Number(e.target.value))}
                  className="bg-black/50 border-white/15 text-xs text-white font-mono"
                  required
                />
              </div>
            </div>

            {/* Row 2: Tagline and Industry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  One-Liner Tagline <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Next-Gen EV Battery Fast-Swapping Grid"
                  value={teamTagline}
                  onChange={(e) => setTeamTagline(e.target.value)}
                  className="bg-black/50 border-white/15 text-xs text-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Industry / Sector <span className="text-rose-400">*</span>
                </label>
                <select
                  value={teamIndustry}
                  onChange={(e) => setTeamIndustry(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-white/15 bg-black/50 px-3 py-1 text-xs font-mono text-white shadow-sm focus-visible:outline-none"
                >
                  <option value="Fintech & Web3">Fintech & Web3</option>
                  <option value="CleanTech & EV Mobility">CleanTech & EV Mobility</option>
                  <option value="AI & DeepTech">AI & DeepTech</option>
                  <option value="HealthTech & Diagnostics">HealthTech & Diagnostics</option>
                  <option value="EdTech & Learning">EdTech & Learning</option>
                  <option value="AgriTech & Robotics">AgriTech & Robotics</option>
                  <option value="Consumer & D2C">Consumer & D2C</option>
                  <option value="SaaS & Enterprise">SaaS & Enterprise</option>
                  <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                  <option value="Aerospace & Defense">Aerospace & Defense</option>
                  <option value="General Innovation">General Innovation</option>
                </select>
              </div>
            </div>

            {/* Row 3: Idea / Pitch summary (Required) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                  Startup Idea & Core Innovation <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] font-mono text-zinc-400">
                  Explain the problem, solution, and business concept
                </span>
              </div>
              <textarea
                rows={3}
                placeholder="Describe the startup's core concept, unique value proposition, and innovation being pitched on stage..."
                value={teamIdea}
                onChange={(e) => setTeamIdea(e.target.value)}
                className="w-full rounded-md border border-white/15 bg-black/50 p-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-cyan-500"
                required
              />
            </div>

            {/* Financial Requirements Strip */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Financial Calibration & Share Valuation
                </span>
                <span className="text-[11px] font-mono text-zinc-400">All fields required</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Funding Ask */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-300">
                    Funding Ask (₹) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="number"
                    min={10000}
                    step={50000}
                    value={teamAsk}
                    onChange={(e) => setTeamAsk(Number(e.target.value))}
                    className="bg-black/60 border-white/15 text-xs text-white font-mono"
                    required
                  />
                  <span className="text-[10px] font-mono text-emerald-400 block font-bold">
                    {formatINR(teamAsk)}
                  </span>
                </div>

                {/* Share Value / Price */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-300">
                    Share Value (LTP ₹) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={teamSharePrice}
                    onChange={(e) => setTeamSharePrice(Number(e.target.value))}
                    className="bg-black/60 border-white/15 text-xs text-white font-mono"
                    required
                  />
                  <span className="text-[10px] font-mono text-cyan-300 block font-bold">
                    {formatSharePrice(teamSharePrice)}
                  </span>
                </div>

                {/* Equity Offered */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-300">
                    Equity Offered (%) <span className="text-rose-400">*</span>
                  </label>
                  <Input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.5}
                    value={teamEquity}
                    onChange={(e) => setTeamEquity(Number(e.target.value))}
                    className="bg-black/60 border-white/15 text-xs text-white font-mono"
                    required
                  />
                  <span className="text-[10px] font-mono text-zinc-400 block">
                    {teamEquity}% equity
                  </span>
                </div>
              </div>

              {/* Dynamic Implied Valuation Banner */}
              {teamAsk > 0 && teamEquity > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono">
                  <div>
                    <span className="text-zinc-400">Implied Valuation: </span>
                    <strong className="text-emerald-300 font-bold">
                      {formatINR(Math.round(teamAsk / (teamEquity / 100)))}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400">Authorized Shares: </span>
                    <strong className="text-cyan-300 font-bold">
                      {Math.max(1000, Math.round((teamAsk / (teamEquity / 100)) / (teamSharePrice || 100))).toLocaleString("en-IN")} shares
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Row 4: Founder and Initial Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Founder / Lead Presenter <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Rahul Sharma (CEO)"
                  value={teamFounderName}
                  onChange={(e) => setTeamFounderName(e.target.value)}
                  className="bg-black/50 border-white/15 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Initial Stage Status <span className="text-rose-400">*</span>
                </label>
                <select
                  value={teamStatus}
                  onChange={(e) => setTeamStatus(e.target.value as IPOStatus)}
                  className="flex h-9 w-full rounded-md border border-white/15 bg-black/50 px-3 py-1 text-xs font-mono text-white shadow-sm focus-visible:outline-none"
                >
                  <option value="IPO_OPEN">IPO LIVE (Immediately tradable on exchange)</option>
                  <option value="PITCHING">PITCHING (Presenting on stage)</option>
                  <option value="COMING_UP">COMING UP (Queued in roster)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-3 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterTeamModalOpen(false)}
                className="font-mono text-xs border-white/20 text-zinc-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRegisteringTeam}
                className="font-mono text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-500/20 gap-1.5"
              >
                {isRegisteringTeam ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Registering Team...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Register & Launch Team
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE TEAM CONFIRMATION MODAL */}
      <Dialog open={!!deleteStartupConfirmId} onOpenChange={(open) => !open && setDeleteStartupConfirmId(null)}>
        <DialogContent className="max-w-md bg-[#0c111e]/95 border-rose-500/30 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <Trash2 className="h-5 w-5" /> Delete Startup Team
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-mono text-xs">
              Are you sure you want to permanently delete this team? All associated bids, orders, trades, and holdings will be purged from the matching engine.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-300">
              Target: <strong>{startups.find((s) => s.id === deleteStartupConfirmId)?.name || "Selected Team"}</strong>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeletingStartup}
              onClick={() => setDeleteStartupConfirmId(null)}
              className="font-mono text-xs border-white/20 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeletingStartup}
              onClick={() => deleteStartupConfirmId && handleDeleteStartup(deleteStartupConfirmId)}
              className="font-mono text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 gap-1.5"
            >
              {isDeletingStartup ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Permanently Delete Team
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLEAR ALL TRIAL TEAMS CONFIRMATION MODAL */}
      <Dialog open={clearTrialsModalOpen} onOpenChange={setClearTrialsModalOpen}>
        <DialogContent className="max-w-md bg-[#0c111e]/95 border-rose-500/40 text-white backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-5 w-5" /> Purge All Startup Teams
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-mono text-xs">
              This action will permanently delete all startup teams and their associated trading transactions from the database. User accounts (admin, judges, and audience tokens) will remain intact.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-300">
              Current count: <strong>{startups.length} teams</strong> will be removed.
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isClearingTrials}
              onClick={() => setClearTrialsModalOpen(false)}
              className="font-mono text-xs border-white/20 text-zinc-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isClearingTrials}
              onClick={handleClearTrialTeams}
              className="font-mono text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 gap-1.5"
            >
              {isClearingTrials ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Purging...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Purge All Teams
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
