"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { MobileBottomNav } from "./MobileBottomNav";
import { NavigationProgressBar } from "./NavigationProgressBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const isLandingPage = pathname === "/";

  return (
    <div className="relative min-h-screen bg-[#060810] text-zinc-100 selection:bg-emerald-500 selection:text-black">
      {/* Zero-latency instant navigation progress bar */}
      <NavigationProgressBar />

      {/* Global Keynote Auditorium Background Layer */}
      <div className="fixed inset-0 pointer-events-none -z-50 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat filter brightness-[0.26] contrast-[1.15] saturate-[1.2]"
          style={{ backgroundImage: "url('/auditorium-bg.webp')" }}
        />
        {/* Cinematic Vignette & Warm Gold Ambient Spotlight Highlights */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060810]/92 via-[#070b16]/82 to-[#060810]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,198,135,0.08),_transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,229,153,0.04),_transparent_60%)]" />
      </div>

      {isLandingPage ? (
        <div className="min-h-screen">
          {children}
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
          />
        </div>
      ) : (
        <div className="flex min-h-screen">
          {/* Desktop Persistent Sidebar */}
          <div className="hidden lg:block shrink-0">
            <AppSidebar
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed(!collapsed)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
          </div>

          {/* Mobile Drawer Sidebar */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 border-r border-white/10 w-72 bg-[#060810]">
              <AppSidebar
                collapsed={false}
                onToggleCollapse={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
                onOpenCommandPalette={() => {
                  setMobileOpen(false);
                  setCommandPaletteOpen(true);
                }}
              />
            </SheetContent>
          </Sheet>

          {/* Main Content Area */}
          <div className="relative flex flex-1 flex-col min-w-0 overflow-x-hidden">
            {/* Ambient Top Keynote Glow Mesh */}
            <div className="pointer-events-none absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-amber-500/[0.04] blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 -left-20 h-96 w-96 rounded-full bg-emerald-500/[0.03] blur-3xl" />

            <Topbar
              onToggleSidebar={() => setMobileOpen(true)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
            <main className="relative z-10 flex-1 px-3.5 py-4 pb-28 sm:p-8 lg:p-10 xl:p-12 max-w-[1600px] 2xl:max-w-[1740px] w-full mx-auto animate-in fade-in duration-300">
              {children}
            </main>
          </div>

          {/* Native Mobile Bottom Navigation */}
          <MobileBottomNav onOpenDrawer={() => setMobileOpen(true)} />

          {/* Global Command Palette */}
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
          />
        </div>
      )}
    </div>
  );
}
