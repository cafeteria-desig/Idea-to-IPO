"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  TrendingUp,
  Award,
  Wallet,
  Users,
  Building2,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  onOpenDrawer: () => void;
}

export function MobileBottomNav({ onOpenDrawer }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const getRoleItem = () => {
    if (user?.role === "FII") {
      return {
        label: "VC Judge",
        path: "/fii",
        icon: Building2,
      };
    }
    if (user?.role === "ADMIN") {
      return {
        label: "Admin",
        path: "/admin",
        icon: ShieldCheck,
      };
    }
    return null;
  };

  const roleItem = getRoleItem();

  const navItems = [
    {
      label: "Pitches",
      path: "/teams",
      icon: LayoutDashboard,
      badge: "LIVE",
    },
    {
      label: "Market",
      path: "/market",
      icon: TrendingUp,
    },
    {
      label: "Rankings",
      path: "/leaderboard",
      icon: Award,
    },
    {
      label: "Portfolio",
      path: "/portfolio",
      icon: Wallet,
    },
  ];

  if (roleItem) {
    navItems.push(roleItem);
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-white/[0.08] bg-[#070b14]/95 backdrop-blur-2xl safe-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.65)] select-none"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              prefetch={true}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center py-2 min-h-[48px] touch-manipulation transition-colors active:opacity-70 active:scale-[0.98]",
                isActive ? "text-emerald-400" : "text-zinc-400 md:hover:text-zinc-200"
              )}
            >
              {/* Active Glow Pill */}
              {isActive && (
                <motion.div
                  layoutId="mobileNavActivePill"
                  className="absolute -top-1.5 h-1 w-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(0,229,153,0.8)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-150",
                    isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(0,229,153,0.7)]" : ""
                  )}
                />
                {item.badge === "LIVE" && !isActive && (
                  <span className="absolute -top-1 -right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "text-[10px] tracking-tight mt-1 font-medium transition-colors leading-none",
                  isActive ? "font-bold text-white drop-shadow-sm" : "text-zinc-400"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Fallback menu drawer button if no user role is loaded */}
        {!roleItem && (
          <button
            type="button"
            onClick={onOpenDrawer}
            className="relative flex flex-1 flex-col items-center justify-center py-2 min-h-[48px] touch-manipulation text-zinc-400 md:hover:text-zinc-200 transition-colors active:opacity-70 active:scale-[0.98]"
          >
            <div className="relative">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-zinc-300">
                <Menu className="h-4 w-4" />
              </div>
            </div>
            <span className="text-[10px] tracking-tight mt-1 font-medium text-zinc-400 leading-none">
              Menu
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
