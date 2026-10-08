import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculatePnL } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Retrieve fresh user and portfolio data in parallel
    const [freshUser, dbHoldings, investments, openOrders, recentOrders, recentTrades] =
      await Promise.all([
        prisma.user.findUnique({ where: { id: user.id } }),
        prisma.holding.findMany({
          where: { userId: user.id },
          include: { startup: true },
        }),
        prisma.investment.findMany({
          where: { investorId: user.id },
          include: { startup: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.order.findMany({
          where: {
            userId: user.id,
            status: { in: ["OPEN", "PARTIALLY_FILLED"] },
          },
          include: { startup: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.order.findMany({
          where: { userId: user.id },
          include: { startup: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.trade.findMany({
          where: {
            OR: [{ buyerId: user.id }, { sellerId: user.id }],
          },
          include: { startup: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

    if (!freshUser) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Build unified holdings list
    const holdingsMap = new Map<string, any>();

    // Add dbHoldings first
    for (const h of dbHoldings) {
      if (h.quantity <= 0 && h.realizedPnL === 0) continue;
      const pnl = calculatePnL(h.quantity, h.averageBuyPrice, h.startup.currentPrice);
      holdingsMap.set(h.startupId, {
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
        totalPnL: Number((pnl.unrealizedPnL + h.realizedPnL).toFixed(2)),
        allocationPercent: 0,
        transactionCount: 0,
      });
    }

    // If an investment exists from before or without a Holding record, integrate it
    const validInvestments = investments.filter((i) => i.status === "VALID");
    for (const inv of validInvestments) {
      if (!holdingsMap.has(inv.startupId)) {
        // Fallback for legacy investment without holding: default issue price ₹100
        const defaultPrice = inv.startup.currentPrice || 100;
        const shares = Math.max(1, Math.round(inv.amount / defaultPrice));
        const avgPrice = inv.amount / shares;
        const pnl = calculatePnL(shares, avgPrice, inv.startup.currentPrice);

        holdingsMap.set(inv.startupId, {
          id: `legacy-${inv.startupId}`,
          startupId: inv.startupId,
          startupName: inv.startup.name,
          slug: inv.startup.slug,
          logoUrl: inv.startup.logoUrl,
          industry: inv.startup.industry,
          quantity: shares,
          averageBuyPrice: Number(avgPrice.toFixed(2)),
          currentPrice: inv.startup.currentPrice,
          investedValue: inv.amount,
          currentValue: Number(pnl.currentValue.toFixed(2)),
          unrealizedPnL: Number(pnl.unrealizedPnL.toFixed(2)),
          unrealizedReturnPct: Number(pnl.unrealizedReturnPct.toFixed(2)),
          realizedPnL: 0,
          totalPnL: Number(pnl.unrealizedPnL.toFixed(2)),
          allocationPercent: 0,
          transactionCount: 1,
        });
      } else {
        const item = holdingsMap.get(inv.startupId);
        item.transactionCount += 1;
      }
    }

    const holdingsList = Array.from(holdingsMap.values());

    // Calculate totals
    const totalInvestedValue = holdingsList.reduce((sum, h) => sum + h.investedValue, 0);
    const totalCurrentValue = holdingsList.reduce((sum, h) => sum + h.currentValue, 0);
    const totalUnrealizedPnL = holdingsList.reduce((sum, h) => sum + h.unrealizedPnL, 0);
    const totalRealizedPnL = holdingsList.reduce((sum, h) => sum + h.realizedPnL, 0);
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL;
    const totalPortfolioValue = freshUser.currentBalance + totalCurrentValue;
    const totalReturnPct =
      totalInvestedValue > 0 ? (totalUnrealizedPnL / totalInvestedValue) * 100 : 0;

    // Attach allocation percentages
    holdingsList.forEach((h) => {
      h.allocationPercent =
        totalCurrentValue > 0 ? Math.round((h.currentValue / totalCurrentValue) * 100) : 0;
    });

    const recentTransactions = investments.slice(0, 25).map((inv) => ({
      id: inv.id,
      investorId: inv.investorId,
      investorName: inv.investorName,
      investorType: inv.investorType as "RETAIL" | "FII",
      startupId: inv.startupId,
      startupName: inv.startup?.name,
      amount: inv.amount,
      status: inv.status as "VALID" | "CANCELLED" | "REVERSED" | "UNDER_REVIEW",
      note: inv.note,
      createdAt: inv.createdAt,
    }));

    const formattedOpenOrders = openOrders.map((o) => ({
      id: o.id,
      userId: o.userId,
      startupId: o.startupId,
      startupName: o.startup.name,
      startupSlug: o.startup.slug,
      side: o.side as any,
      type: o.type as any,
      price: o.price,
      quantity: o.quantity,
      filledQuantity: o.filledQuantity,
      remainingQuantity: o.remainingQuantity,
      status: o.status as any,
      reservedAmount: o.reservedAmount,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    const formattedRecentOrders = recentOrders.map((o) => ({
      id: o.id,
      userId: o.userId,
      startupId: o.startupId,
      startupName: o.startup.name,
      startupSlug: o.startup.slug,
      side: o.side as any,
      type: o.type as any,
      price: o.price,
      quantity: o.quantity,
      filledQuantity: o.filledQuantity,
      remainingQuantity: o.remainingQuantity,
      status: o.status as any,
      reservedAmount: o.reservedAmount,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    const formattedRecentTrades = recentTrades.map((t) => ({
      id: t.id,
      startupId: t.startupId,
      startupName: t.startup.name,
      startupSlug: t.startup.slug,
      buyOrderId: t.buyOrderId,
      sellOrderId: t.sellOrderId,
      buyerId: t.buyerId,
      sellerId: t.sellerId,
      price: t.price,
      quantity: t.quantity,
      amount: t.amount,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({
      user: {
        id: freshUser.id,
        name: freshUser.name,
        role: freshUser.role,
        startingCapital: freshUser.startingCapital,
        currentBalance: freshUser.currentBalance,
        totalInvested: freshUser.totalInvested,
      },
      summary: {
        totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
        availableCash: Number(freshUser.currentBalance.toFixed(2)),
        investedValue: Number(totalInvestedValue.toFixed(2)),
        currentValue: Number(totalCurrentValue.toFixed(2)),
        unrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
        realizedPnL: Number(totalRealizedPnL.toFixed(2)),
        totalPnL: Number(totalPnL.toFixed(2)),
        totalReturnPct: Number(totalReturnPct.toFixed(2)),
        holdingsCount: holdingsList.length,
      },
      holdings: holdingsList,
      openOrders: formattedOpenOrders,
      recentOrders: formattedRecentOrders,
      recentTrades: formattedRecentTrades,
      totalHoldingsCount: holdingsList.length,
      recentTransactions,
    });
  } catch (error) {
    console.error("Portfolio API error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch portfolio" }, { status: 500 });
  }
}
