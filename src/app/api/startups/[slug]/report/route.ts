import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const cacheKey = `report:${slug}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const startup = await prisma.startup.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
      },
    });

    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup company not found." },
        { status: 404 }
      );
    }

    // Parallel fetch for cap table, recent trades, and price history
    const [holdings, trades, investments, priceHistory] = await Promise.all([
      prisma.holding.findMany({
        where: {
          startupId: startup.id,
          quantity: { gt: 0 },
        },
        include: {
          user: {
            select: { id: true, name: true, role: true, email: true },
          },
        },
        orderBy: { quantity: "desc" },
      }),
      prisma.trade.findMany({
        where: { startupId: startup.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          buyer: { select: { id: true, name: true, role: true } },
          seller: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.investment.findMany({
        where: { startupId: startup.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.priceHistory.findMany({
        where: { startupId: startup.id },
        orderBy: { timestamp: "asc" },
        take: 50,
      }),
    ]);

    // Cap Table Calculations
    const totalShares = startup.totalShares || 1000000;
    const totalInvestorShares = holdings.reduce((sum, h) => sum + h.quantity, 0);
    const availableShares = Math.max(0, totalShares - totalInvestorShares);
    const dilutionPercent = Number(((totalInvestorShares / totalShares) * 100).toFixed(2));
    const founderRetainedPercent = Number((100 - dilutionPercent).toFixed(2));

    let retailCapital = 0;
    let fiiCapital = 0;
    let angelCapital = 0;

    const capTable = holdings.map((h, index) => {
      const equityPct = Number(((h.quantity / totalShares) * 100).toFixed(2));
      const currentValue = Number((h.quantity * startup.currentPrice).toFixed(2));
      const pnl = currentValue - h.totalInvested;

      if (h.user.role === "RETAIL") retailCapital += h.totalInvested;
      else if (h.user.role === "FII") fiiCapital += h.totalInvested;
      else angelCapital += h.totalInvested;

      return {
        rank: index + 1,
        userId: h.user.id,
        name: h.user.name,
        role: h.user.role,
        shares: h.quantity,
        totalInvested: h.totalInvested,
        averageBuyPrice: h.averageBuyPrice,
        currentValue,
        pnl,
        equityPercent: equityPct,
      };
    });

    const fundingAsk = startup.fundingAsk || 10000000;
    const totalRaised = startup.totalInvestmentReceived || 0;
    const subscriptionPercent = Number(((totalRaised / fundingAsk) * 100).toFixed(1));
    const marketCap = Number((totalShares * startup.currentPrice).toFixed(2));

    let founderName = "Founding Team";
    try {
      const tm = JSON.parse(startup.teamMembers || "[]");
      if (Array.isArray(tm) && tm.length > 0 && tm[0]?.name) {
        founderName = tm[0].name;
      }
    } catch (e) {}

    const responseData = {
      success: true,
      startup: {
        id: startup.id,
        name: startup.name,
        slug: startup.slug,
        idea: startup.pitchSummary || startup.tagLine,
        tagLine: startup.tagLine,
        pitchSummary: startup.pitchSummary,
        industry: startup.industry,
        currentPrice: startup.currentPrice,
        previousPrice: startup.previousPrice,
        dayHigh: startup.dayHigh || startup.currentPrice,
        dayLow: startup.dayLow || startup.currentPrice,
        openPrice: startup.openPrice || startup.initialPrice || 100,
        totalVolume: startup.totalVolume || 0,
        totalShares,
        availableShares,
        totalInvestorShares,
        dilutionPercent,
        founderRetainedPercent,
        fundingAsk,
        totalRaised,
        subscriptionPercent,
        marketCap,
        equityOffered: startup.equityOffered,
        pitchOrder: startup.pitchOrder,
        ipoStatus: startup.ipoStatus,
        founderName,
        problem: startup.problem,
        solution: startup.solution,
        businessModel: startup.businessModel,
      },
      capitalBreakdown: {
        totalRaised,
        fundingAsk,
        retailCapital,
        fiiCapital,
        angelCapital,
        subscriptionPercent,
      },
      capTable,
      recentTrades: trades.map((t) => ({
        id: t.id,
        price: t.price,
        quantity: t.quantity,
        amount: t.amount,
        createdAt: t.createdAt,
        buyerName: t.buyer?.name || "Audience Investor",
        buyerRole: t.buyer?.role || "RETAIL",
        sellerName: t.seller?.name || "Liquidity Pool",
        sellerRole: t.seller?.role || "MARKET_MAKER",
      })),
      investments: investments.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        investorName: inv.investorName,
        investorType: inv.investorType,
        status: inv.status,
        note: inv.note,
        createdAt: inv.createdAt,
      })),
      priceHistory: priceHistory.map((ph) => ({
        price: ph.price,
        volume: ph.volume,
        timestamp: ph.timestamp,
      })),
    };

    setCached(cacheKey, responseData, 3000);
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("Founder report error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate founder report" },
      { status: 500 }
    );
  }
}
