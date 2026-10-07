import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const marketState =
      (await prisma.marketState.findUnique({ where: { id: "global" } })) || {
        isMarketActive: true,
        activeStartupId: null,
        hideInvestorNamesPublicly: false,
        bannerMessage: null,
      };

    const rawStartups = await prisma.startup.findMany({
      orderBy: { pitchOrder: "asc" },
    });

    // Enrich startups with stock metrics
    const stocks = rawStartups.map((s) => {
      const openPrice = s.openPrice || s.initialPrice || 100;
      const priceChange = Number((s.currentPrice - openPrice).toFixed(2));
      const percentageChange = Number((((s.currentPrice - openPrice) / openPrice) * 100).toFixed(2));
      const marketCap = Number((s.totalShares * s.currentPrice).toFixed(2));

      return {
        ...s,
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
    const topGainers = [...stocks].sort((a, b) => b.percentageChange - a.percentageChange);

    // Top Losers (lowest percentage change)
    const topLosers = [...stocks].sort((a, b) => a.percentageChange - b.percentageChange);

    // Most Traded (highest total volume)
    const mostTraded = [...stocks].sort((a, b) => b.totalVolume - a.totalVolume);

    const validInvestments = await prisma.investment.findMany({
      where: { status: "VALID" },
      orderBy: { createdAt: "asc" },
    });

    const totalMarketInvestment = stocks.reduce((acc, s) => acc + s.totalInvestmentReceived, 0);
    const totalRetailInvestment = stocks.reduce((acc, s) => acc + s.retailInvestment, 0);
    const totalFIIInvestment = stocks.reduce((acc, s) => acc + s.fiiInvestment, 0);
    const totalVolume = stocks.reduce((acc, s) => acc + s.totalVolume, 0);

    const uniqueInvestors = new Set(validInvestments.map((i) => i.investorId));
    const openIposCount = stocks.filter((s) => s.ipoStatus === "IPO_OPEN").length;

    const recentActivities = await prisma.activityFeed.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    const maskedActivities = recentActivities.map((act) => ({
      ...act,
      investorName: marketState.hideInvestorNamesPublicly
        ? "Verified Investor"
        : act.investorName,
    }));

    // Build cumulative trend data points
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

    validInvestments.forEach((inv, index) => {
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

    return NextResponse.json({
      isMarketActive: marketState.isMarketActive,
      activeStartupId: marketState.activeStartupId,
      activeStartup,
      hideInvestorNamesPublicly: marketState.hideInvestorNamesPublicly,
      bannerMessage: marketState.bannerMessage,
      totalMarketInvestment,
      totalRetailInvestment,
      totalFIIInvestment,
      totalVolume,
      activeInvestorsCount: uniqueInvestors.size,
      totalStartupsCount: stocks.length,
      openIposCount,
      totalTransactionsCount: validInvestments.length,
      stocks,
      leaderboard,
      topGainers,
      topLosers,
      mostTraded,
      recentActivities: maskedActivities,
      chartTrends: sampledTrends,
    });
  } catch (error) {
    console.error("Market overview error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch market overview" },
      { status: 500 }
    );
  }
}
