import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cacheKey = "market:overview";
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Parallel fetch all core market telemetry
    const [marketStateRes, rawStartups, holdingSums, recentInvestments, recentActivities] =
      await Promise.all([
        prisma.marketState.findUnique({ where: { id: "global" } }),
        prisma.startup.findMany({ orderBy: { pitchOrder: "asc" } }),
        prisma.holding.groupBy({
          by: ["startupId"],
          _sum: { quantity: true },
          where: { user: { role: { not: "ADMIN" } } },
        }),
        prisma.investment.findMany({
          where: { status: "VALID" },
          orderBy: { createdAt: "desc" },
          take: 60,
        }),
        prisma.activityFeed.findMany({
          where: { isPublic: true },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
      ]);

    const marketState = marketStateRes || {
      isMarketActive: true,
      activeStartupId: null,
      hideInvestorNamesPublicly: false,
      bannerMessage: null,
    };

    const holdingMap = new Map<string, number>();
    for (const h of holdingSums) {
      holdingMap.set(h.startupId, h._sum.quantity || 0);
    }

    // Enrich startups with stock metrics and availableShares
    const stocks = rawStartups.map((s) => {
      const openPrice = s.openPrice || s.initialPrice || 100;
      const priceChange = Number((s.currentPrice - openPrice).toFixed(2));
      const percentageChange = Number((((s.currentPrice - openPrice) / openPrice) * 100).toFixed(2));
      const marketCap = Number((s.totalShares * s.currentPrice).toFixed(2));
      const heldShares = holdingMap.get(s.id) || 0;
      const availableShares = Math.max(0, Math.floor(s.totalShares - heldShares));

      return {
        ...s,
        availableShares,
        priceChange,
        percentageChange,
        marketCap,
      };
    });

    const activeStartup = stocks.find((s) => s.id === marketState.activeStartupId) || stocks[0] || null;

    // Leaderboard sorted by totalInvestmentReceived desc
    const leaderboard = [...stocks].sort(
      (a, b) => b.totalInvestmentReceived - a.totalInvestmentReceived
    );

    // Top Gainers (highest percentage change)
    const topGainers = [...stocks].sort((a, b) => (b.percentageChange ?? 0) - (a.percentageChange ?? 0));

    // Top Losers (lowest percentage change)
    const topLosers = [...stocks].sort((a, b) => (a.percentageChange ?? 0) - (b.percentageChange ?? 0));

    // Most Traded (highest total volume)
    const mostTraded = [...stocks].sort((a, b) => (b.totalVolume ?? 0) - (a.totalVolume ?? 0));

    const totalMarketInvestment = stocks.reduce((acc, s) => acc + s.totalInvestmentReceived, 0);
    const totalRetailInvestment = stocks.reduce((acc, s) => acc + s.retailInvestment, 0);
    const totalFIIInvestment = stocks.reduce((acc, s) => acc + s.fiiInvestment, 0);
    const totalVolume = stocks.reduce((acc, s) => acc + s.totalVolume, 0);

    const uniqueInvestors = new Set(recentInvestments.map((i) => i.investorId));
    const openIposCount = stocks.filter((s) => s.ipoStatus === "IPO_OPEN").length;

    const maskedActivities = recentActivities.map((act) => ({
      ...act,
      investorName: marketState.hideInvestorNamesPublicly
        ? "Verified Investor"
        : act.investorName,
    }));

    // Build cumulative trend data points in chronological order
    const investmentsAsc = [...recentInvestments].reverse();
    const startupRunningTotals: Record<string, number> = {};
    stocks.forEach((s) => {
      startupRunningTotals[s.name] = 0;
    });

    const chartTrends = [
      {
        time: "Start",
        ...startupRunningTotals,
      },
    ];

    investmentsAsc.forEach((inv, index) => {
      const targetStartup = stocks.find((s) => s.id === inv.startupId);
      if (targetStartup) {
        startupRunningTotals[targetStartup.name] =
          (startupRunningTotals[targetStartup.name] || 0) + inv.amount;
        const timeLabel = new Date(inv.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        chartTrends.push({
          time: `#${index + 1} (${timeLabel})`,
          ...startupRunningTotals,
        });
      }
    });

    const sampledTrends =
      chartTrends.length > 25
        ? [chartTrends[0], ...chartTrends.slice(chartTrends.length - 24)]
        : chartTrends;

    const payload = {
      isMarketActive: marketState.isMarketActive,
      activeStartupId: marketState.activeStartupId,
      activeStartup,
      hideInvestorNamesPublicly: marketState.hideInvestorNamesPublicly,
      bannerMessage: marketState.bannerMessage,
      totalMarketInvestment,
      totalRetailInvestment,
      totalFIIInvestment,
      totalVolume,
      activeInvestorsCount: Math.max(uniqueInvestors.size, 1),
      totalStartupsCount: stocks.length,
      openIposCount,
      totalTransactionsCount: recentInvestments.length,
      stocks,
      leaderboard,
      topGainers,
      topLosers,
      mostTraded,
      recentActivities: maskedActivities,
      chartTrends: sampledTrends,
    };

    setCached(cacheKey, payload, 1500);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Market overview error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch market overview" },
      { status: 500 }
    );
  }
}
