import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { rebalanceMarketMakerLiquidity } from "@/lib/trading/engine";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const startupId = params.id;
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Director / Admin authorization required." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      action,
      newPrice,
      newShares,
      totalShares,
      percentage,
      percentChange,
      side,
      quantity,
      reason,
    } = body;
    const finalShares = newShares ?? totalShares;
    const finalPercentage = percentage ?? percentChange;

    const startup = await prisma.startup.findUnique({
      where: { id: startupId },
    });

    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup / Company not found." },
        { status: 404 }
      );
    }

    let updatedStartup = startup;
    let message = "";

    switch (action) {
      // 1. Direct LTP / Price Override
      case "SET_PRICE": {
        const targetPrice = Number(Number(newPrice).toFixed(2));
        if (isNaN(targetPrice) || targetPrice <= 0) {
          return NextResponse.json(
            { success: false, message: "Invalid target share price." },
            { status: 400 }
          );
        }

        const oldPrice = startup.currentPrice;
        const newHigh = Math.max(startup.dayHigh || targetPrice, targetPrice);
        const newLow = startup.dayLow ? Math.min(startup.dayLow, targetPrice) : targetPrice;

        updatedStartup = await prisma.startup.update({
          where: { id: startupId },
          data: {
            previousPrice: oldPrice,
            currentPrice: targetPrice,
            dayHigh: newHigh,
            dayLow: newLow,
          },
        });

        // Record in price history
        await prisma.priceHistory.create({
          data: {
            startupId,
            price: targetPrice,
            volume: 0,
          },
        });

        // Re-center Market Maker order book around the new forced price
        await rebalanceMarketMakerLiquidity(startupId, targetPrice);
        invalidateCache();

        message = `Share price forced from ₹${oldPrice.toFixed(2)} to ₹${targetPrice.toFixed(2)} for ${startup.name}.`;
        break;
      }

      // 2. Percentage Pump / Dump Nudge
      case "NUDGE_PRICE": {
        const pct = Number(finalPercentage);
        if (isNaN(pct) || pct === 0) {
          return NextResponse.json(
            { success: false, message: "Invalid percentage adjustment." },
            { status: 400 }
          );
        }

        const oldPrice = startup.currentPrice;
        const targetPrice = Number(Math.max(1.00, oldPrice * (1 + pct / 100)).toFixed(2));
        const newHigh = Math.max(startup.dayHigh || targetPrice, targetPrice);
        const newLow = startup.dayLow ? Math.min(startup.dayLow, targetPrice) : targetPrice;

        updatedStartup = await prisma.startup.update({
          where: { id: startupId },
          data: {
            previousPrice: oldPrice,
            currentPrice: targetPrice,
            dayHigh: newHigh,
            dayLow: newLow,
          },
        });

        await prisma.priceHistory.create({
          data: {
            startupId,
            price: targetPrice,
            volume: 0,
          },
        });

        await rebalanceMarketMakerLiquidity(startupId, targetPrice);
        invalidateCache();

        message = `Price nudged ${pct > 0 ? "+" : ""}${pct}%: ₹${oldPrice.toFixed(2)} -> ₹${targetPrice.toFixed(2)}.`;
        break;
      }

      // 3. Adjust Total Shares Pool
      case "SET_TOTAL_SHARES": {
        const targetShares = Math.floor(Number(finalShares));
        if (isNaN(targetShares) || targetShares <= 0) {
          return NextResponse.json(
            { success: false, message: "Total shares must be a positive integer." },
            { status: 400 }
          );
        }

        updatedStartup = await prisma.startup.update({
          where: { id: startupId },
          data: {
            totalShares: targetShares,
          },
        });

        invalidateCache();
        message = `Total shares pool adjusted to ${targetShares.toLocaleString("en-IN")} shares.`;
        break;
      }

      // 4. Inject Simulated Volume (Market Pressure)
      case "INJECT_VOLUME": {
        const tradeQty = Math.floor(Number(quantity));
        if (isNaN(tradeQty) || tradeQty <= 0) {
          return NextResponse.json(
            { success: false, message: "Quantity must be a positive integer." },
            { status: 400 }
          );
        }

        const isBuy = side === "BUY";
        const oldPrice = startup.currentPrice;
        // Natural market impact: ~0.8% per 25 shares, bounded between 1% and 15%
        const deltaPct = Math.min(0.20, Math.max(0.01, (tradeQty / 250) * 0.035));
        const targetPrice = isBuy
          ? Number((oldPrice * (1 + deltaPct)).toFixed(2))
          : Number(Math.max(1.00, oldPrice * (1 - deltaPct)).toFixed(2));

        const tradeAmount = Number((tradeQty * targetPrice).toFixed(2));

        updatedStartup = await prisma.startup.update({
          where: { id: startupId },
          data: {
            previousPrice: oldPrice,
            currentPrice: targetPrice,
            dayHigh: Math.max(startup.dayHigh || targetPrice, targetPrice),
            dayLow: startup.dayLow ? Math.min(startup.dayLow, targetPrice) : targetPrice,
            totalVolume: { increment: tradeQty },
            ...(isBuy ? { totalInvestmentReceived: { increment: tradeAmount } } : {}),
          },
        });

        await prisma.priceHistory.create({
          data: {
            startupId,
            price: targetPrice,
            volume: tradeQty,
          },
        });

        // Add activity feed record
        await prisma.activityFeed.create({
          data: {
            type: "TRADE",
            message: `Institutional Market Maker executed ${isBuy ? "BUY" : "SELL"} block of ${tradeQty.toLocaleString()} shares of ${startup.name} at ₹${targetPrice.toFixed(2)}`,
            startupName: startup.name,
            investorName: "Exchange Liquidity Provider",
            amount: tradeAmount,
            isPublic: true,
          },
        });

        await rebalanceMarketMakerLiquidity(startupId, targetPrice);
        invalidateCache();

        message = `Injected ${isBuy ? "BUY" : "SELL"} pressure of ${tradeQty} shares. New LTP: ₹${targetPrice.toFixed(2)}.`;
        break;
      }

      // 5. Force Rebalance Order Book
      case "REBALANCE_BOOK": {
        await rebalanceMarketMakerLiquidity(startupId, startup.currentPrice);
        invalidateCache();
        message = `Market maker order book wiped and refreshed around current LTP ₹${startup.currentPrice.toFixed(2)}.`;
        break;
      }

      default:
        return NextResponse.json(
          { success: false, message: `Unknown manipulation action: ${action}` },
          { status: 400 }
        );
    }

    // Log in audit log if available
    try {
      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name || "Director",
          action: `STOCK_MANIPULATION_${action}`,
          targetType: "STARTUP",
          targetId: startupId,
          reason: `${message} (${reason || "Manual Director Override"})`,
        },
      });
    } catch (e) {
      // ignore non-critical audit log failure
    }

    return NextResponse.json({
      success: true,
      message,
      startup: updatedStartup,
    });
  } catch (error: any) {
    console.error("Stock manipulation error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to execute manipulation." },
      { status: 500 }
    );
  }
}
