import React from "react";

export default function GlobalLoading() {
  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4 sm:pb-6">
        <div className="space-y-2">
          <div className="h-8 sm:h-10 w-48 sm:w-72 rounded-2xl bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-64 sm:w-96 rounded-xl bg-white/[0.03] animate-pulse" />
        </div>
        <div className="h-11 w-36 rounded-2xl bg-white/[0.05] animate-pulse" />
      </div>

      {/* Grid of Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/[0.06] animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded-lg bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-16 rounded-lg bg-white/[0.03] animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-pulse" />
            </div>

            <div className="h-28 rounded-2xl bg-white/[0.02] border border-white/[0.04] p-4 flex flex-col justify-end space-y-2">
              <div className="h-3 w-full rounded bg-white/[0.03] animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-white/[0.04] animate-pulse" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
              <div className="h-4 w-20 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-9 w-24 rounded-xl bg-emerald-500/15 border border-emerald-500/30 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
