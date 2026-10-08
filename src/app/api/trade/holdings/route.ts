import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculatePnL } from "@/lib/formatters";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const userId = user?.id || searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const cacheKey = `holdings:${userId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, holdings: cached });
    }

    const holdings = await prisma.holding.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: {
        startup: true,
      },
      orderBy: { totalInvested: "desc" },
    });

    const totalPortfolioInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);

    const formattedHoldings = holdings.map((h) => {
      const pnl = calculatePnL(h.quantity, h.averageBuyPrice, h.startup.currentPrice);
      const totalPnL = pnl.unrealizedPnL + h.realizedPnL;
      const allocationPercent =
        totalPortfolioInvested > 0
          ? Math.round((h.totalInvested / totalPortfolioInvested) * 100)
          : 0;

      return {
        id: h.id,
        startupId: h.startupId,
        startupName: h.startup.name,
        slug: h.startup.slug,
        logoUrl: h.startup.logoUrl,
        industry: h.startup.industry,
        quantity: h.quantity,
        averageBuyPrice: Number(h.averageBuyPrice.toFixed(2)),
        currentPrice: h.startup.currentPrice,
        investedValue: Number(pnl.investedValue.toFixed(2)),
        currentValue: Number(pnl.currentValue.toFixed(2)),
        unrealizedPnL: Number(pnl.unrealizedPnL.toFixed(2)),
        unrealizedReturnPct: Number(pnl.unrealizedReturnPct.toFixed(2)),
        realizedPnL: Number(h.realizedPnL.toFixed(2)),
        totalPnL: Number(totalPnL.toFixed(2)),
        allocationPercent,
      };
    });

    setCached(cacheKey, formattedHoldings, 1500);
    return NextResponse.json({ success: true, holdings: formattedHoldings });
  } catch (error: any) {
    console.error("Holdings API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch holdings." },
      { status: 500 }
    );
  }
}
