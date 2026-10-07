import React from "react";
import { cn } from "@/lib/utils";
import type { IPOStatus } from "@/types";

interface StatusBadgeProps {
  status: IPOStatus | string;
  className?: string;
  showDot?: boolean;
}

export const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; dotClass: string }
> = {
  COMING_UP: {
    label: "COMING UP",
    className: "bg-zinc-800 text-zinc-400 border-zinc-700/60",
    dotClass: "bg-zinc-500",
  },
  PITCHING: {
    label: "NOW PITCHING",
    className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-sm shadow-cyan-500/10",
    dotClass: "bg-cyan-400 animate-ping",
  },
  QA: {
    label: "Q&A SESSION",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/40",
    dotClass: "bg-purple-400",
  },
  IPO_OPEN: {
    label: "IPO LIVE",
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20",
    dotClass: "bg-emerald-400 animate-pulse",
  },
  IPO_PAUSED: {
    label: "IPO PAUSED",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm shadow-amber-500/10",
    dotClass: "bg-amber-400",
  },
  IPO_CLOSED: {
    label: "MARKET CLOSED",
    className: "bg-slate-500/20 text-slate-400 border-slate-600/40",
    dotClass: "bg-slate-500",
  },
  UNDER_REVIEW: {
    label: "UNDER REVIEW",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    dotClass: "bg-blue-400",
  },
  FINALIZED: {
    label: "FINALIZED",
    className: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
    dotClass: "bg-indigo-400",
  },
  DISQUALIFIED: {
    label: "DISQUALIFIED",
    className: "bg-rose-500/20 text-rose-400 border-rose-500/40",
    dotClass: "bg-rose-400",
  },
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-zinc-800 text-zinc-300 border-zinc-700",
    dotClass: "bg-zinc-400",
  };

  const isLive = status === "IPO_OPEN" || status === "PITCHING";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider border transition-all duration-200",
        isLive ? "shadow-[0_0_15px_rgba(0,229,153,0.2)]" : "",
        config.className,
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
          {isLive && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-80",
                config.dotClass
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", config.dotClass)} />
        </span>
      )}
      {config.label}
    </span>
  );
}
