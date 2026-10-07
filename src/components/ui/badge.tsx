import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "emerald" | "cyan" | "amber" | "rose";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-white/10 text-white hover:bg-white/20",
    secondary: "border-transparent bg-zinc-800 text-zinc-300",
    destructive: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    outline: "text-zinc-300 border-white/20",
    emerald: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
    cyan: "border-cyan-500/40 bg-cyan-500/15 text-cyan-400",
    amber: "border-amber-500/40 bg-amber-500/15 text-amber-400",
    rose: "border-rose-500/40 bg-rose-500/15 text-rose-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
