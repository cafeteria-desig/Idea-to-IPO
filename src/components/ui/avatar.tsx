import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Avatar({ className, children, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5 items-center justify-center font-bold text-xs uppercase text-emerald-400 select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
