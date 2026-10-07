import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "cyber" | "neon";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-emerald-500 text-black hover:bg-emerald-400 font-semibold shadow-md shadow-emerald-500/20 active:scale-[0.98]",
      destructive: "bg-rose-500/90 text-white hover:bg-rose-600 shadow-md shadow-rose-500/20 active:scale-[0.98]",
      outline: "border border-white/15 bg-transparent hover:bg-white/10 text-white active:scale-[0.98]",
      secondary: "bg-white/10 text-white hover:bg-white/15 active:scale-[0.98]",
      ghost: "hover:bg-white/10 text-zinc-300 hover:text-white",
      link: "text-cyan-400 underline-offset-4 hover:underline",
      cyber: "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-bold shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-[0.98]",
      neon: "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/30",
    };

    const sizeStyles = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-8 text-base",
      icon: "h-10 w-10 p-0 flex items-center justify-center",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
