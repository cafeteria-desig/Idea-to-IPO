import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatINR } from "@/lib/formatters";
import { rebalanceMarketMakerLiquidity } from "@/lib/trading/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startupId, amount, userId } = body;

    // Determine target user
    let user = await getCurrentUser(req);
    if (!user && userId) {
      const found = await prisma.user.findUnique({ where: { id: userId } });
      if (found && found.status !== "BLOCKED") {
        user = {
          id: found.id,
          name: found.name,
          email: found.email,
          phone: found.phone,
          role: found.role as any,
          status: found.status as any,
          startingCapital: found.startingCapital,
          currentBalance: found.currentBalance,
          totalInvested: found.totalInvested,
          isOnline: found.isOnline,
          lastActiveAt: found.lastActiveAt,
          startupId: found.startupId,
        };
      }
    }

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized: Please log in." }, { status: 401 });
    }

    if (user.role !== "RETAIL" && user.role !== "FII") {
      return NextResponse.json(
        { success: false, message: "Only Retail investors and FII judges can place bids." },
        { status: 403 }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ success: false, message: "Invalid investment amount." }, { status: 400 });
    }

    // 1. Check Global Emergency Circuit Breaker
    const marketState = await prisma.marketState.findUnique({ where: { id: "global" } });
    if (!marketState || !marketState.isMarketActive) {
      return NextResponse.json(
        { success: false, message: "The entire market is currently PAUSED by event administrators." },
        { status: 403 }
      );
    }

    // 2. Atomic Transaction Execution
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch and lock user record
      const freshUser = await tx.user.findUnique({ where: { id: user.id } });
      if (!freshUser || freshUser.status === "BLOCKED") {
        throw new Error("User account is invalid or blocked.");
      }

      if (freshUser.currentBalance < amount) {
        throw new Error("Insufficient available balance!");
      }

      // Check startup
      const startup = await tx.startup.findUnique({ where: { id: startupId } });
      if (!startup) {
        throw new Error("Startup not found.");
      }

      if (startup.ipoStatus !== "IPO_OPEN") {
        throw new Error(`Startup IPO is currently in '${startup.ipoStatus}' state and cannot accept bids.`);
      }

      // Generate unique INV-XXXXXX ID
      let invId = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      // Check collision just in case
      const existing = await tx.investment.findUnique({ where: { id: invId } });
      if (existing) {
        invId = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      // Decrement user balance & increment total invested
      const updatedUser = await tx.user.update({
        where: { id: freshUser.id },
        data: {
          currentBalance: { decrement: amount },
          totalInvested: { increment: amount },
          lastActiveAt: new Date(),
        },
      });

      // Create Investment record
      const investment = await tx.investment.create({
        data: {
          id: invId,
          investorId: freshUser.id,
          investorName: freshUser.name,
          investorType: freshUser.role as "RETAIL" | "FII",
          startupId: startup.id,
          amount: amount,
          status: "VALID",
        },
      });

      // Calculate highly sensitive valuation/share price appreciation from institutional/retail investment
      const fundingAsk = startup.fundingAsk || 10000000;
      const ratio = amount / fundingAsk;
      // Sensitive price discovery without artificial 15% ceiling:
      // Minimum +3% for any investment, scaling dynamically up into 50%, 200%, 500%+ for heavy cheques
      const priceGrowthPct = Math.max(0.03, ratio * 2.0);
      const currentPrice = startup.currentPrice || 100;
      const newPrice = Number((currentPrice * (1 + priceGrowthPct)).toFixed(2));
      const newHigh = Math.max(startup.dayHigh || currentPrice, newPrice);
      const shares = Math.max(1, Math.round(amount / newPrice));

      // Increment startup totals and share price metrics
      const updatedStartup = await tx.startup.update({
        where: { id: startup.id },
        data: {
          previousPrice: currentPrice,
          currentPrice: newPrice,
          dayHigh: newHigh,
          totalVolume: { increment: shares },
          totalInvestmentReceived: { increment: amount },
          ...(freshUser.role === "RETAIL" ? { retailInvestment: { increment: amount } } : {}),
          ...(freshUser.role === "FII" ? { fiiInvestment: { increment: amount } } : {}),
          investorCount: { increment: 1 },
        },
      });

      // Synchronize Holding record for stock portfolio
      const existingHolding = await tx.holding.findUnique({
        where: { userId_startupId: { userId: freshUser.id, startupId: startup.id } },
      });
      if (existingHolding) {
        const newQty = existingHolding.quantity + shares;
        const newInvested = existingHolding.totalInvested + amount;
        const newAvg = newInvested / newQty;
        await tx.holding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: newQty,
            totalInvested: newInvested,
            averageBuyPrice: Number(newAvg.toFixed(2)),
          },
        });
      } else {
        await tx.holding.create({
          data: {
            userId: freshUser.id,
            startupId: startup.id,
            quantity: shares,
            averageBuyPrice: newPrice,
            totalInvested: amount,
          },
        });
      }

      // Record price history
      await tx.priceHistory.create({
        data: {
          startupId: startup.id,
          price: newPrice,
          volume: shares,
        },
      });

      // Re-center dynamic market maker liquidity around the newly established valuation price
      await rebalanceMarketMakerLiquidity(startup.id, newPrice, tx);

      // Broadcast to activity feed
      await tx.activityFeed.create({
        data: {
          type: "INVESTMENT",
          message: `${freshUser.name} (${freshUser.role}) invested ${formatINR(amount)} in ${startup.name}`,
          startupName: startup.name,
          investorName: freshUser.name,
          amount: amount,
          isPublic: true,
        },
      });

      return {
        investment,
        updatedUser,
        updatedStartup,
      };
    });

    return NextResponse.json({
      success: true,
      transactionId: result.investment.id,
      amount: result.investment.amount,
      startupName: result.updatedStartup.name,
      newAvailableBalance: result.updatedUser.currentBalance,
      totalInvested: result.updatedUser.totalInvested,
      message: `Successfully invested ${formatINR(result.investment.amount)} in ${result.updatedStartup.name}!`,
    });
  } catch (error: any) {
    console.error("Investment API error:", error);
    const message = error.message || "Failed to execute investment.";
    const status = message.includes("Insufficient") || message.includes("cannot accept bids") ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
