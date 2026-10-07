"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children }: { children: React.ReactNode }) {
  return <div className="group relative inline-flex">{children}</div>;
}

export function TooltipTrigger({
  asChild,
  children,
  className,
}: {
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("inline-flex cursor-pointer", className)}>{children}</div>;
}

export function TooltipContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 overflow-hidden rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 shadow-md transition-all duration-150 opacity-0 group-hover:opacity-100 whitespace-nowrap",
        className
      )}
    >
      {children}
    </div>
  );
}
