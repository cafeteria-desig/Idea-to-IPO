import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startupId = searchParams.get("startupId");
    const range = searchParams.get("range") || "1D"; // "5M", "30M", "1H", "1D", "ALL"

    if (!startupId) {
      return NextResponse.json(
        { success: false, message: "startupId is required." },
        { status: 400 }
      );
    }

    const startup = await prisma.startup.findUnique({
      where: { id: startupId },
    });

    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup not found." },
        { status: 404 }
      );
    }

    // Determine timestamp cutoff
    const now = Date.now();
    let cutoffDate: Date | undefined;

    switch (range.toUpperCase()) {
      case "5M":
        cutoffDate = new Date(now - 5 * 60 * 1000);
        break;
      case "30M":
        cutoffDate = new Date(now - 30 * 60 * 1000);
        break;
      case "1H":
        cutoffDate = new Date(now - 60 * 60 * 1000);
        break;
      case "1D":
        cutoffDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case "ALL":
      default:
        cutoffDate = undefined;
        break;
    }

    const whereClause: any = { startupId };
    if (cutoffDate) {
      whereClause.timestamp = { gte: cutoffDate };
    }

    let history = await prisma.priceHistory.findMany({
      where: whereClause,
      orderBy: { timestamp: "asc" },
      take: 200,
    });

    // If no history exists in window, generate at least open and current price anchor points
    if (history.length === 0) {
      const openPrice = startup.openPrice || startup.initialPrice || 100;
      const currentPrice = startup.currentPrice || 100;
      const anchorTime = cutoffDate ? cutoffDate.toISOString() : new Date(now - 3600000).toISOString();

      return NextResponse.json({
        success: true,
        startupId,
        range,
        currentPrice,
        openPrice,
        data: [
          {
            price: openPrice,
            volume: 0,
            timestamp: anchorTime,
            timeLabel: new Date(anchorTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          {
            price: currentPrice,
            volume: startup.totalVolume,
            timestamp: new Date().toISOString(),
            timeLabel: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      });
    }

    // Format points with localized timeLabel
    const formattedData = history.map((item) => ({
      id: item.id,
      price: item.price,
      volume: item.volume,
      timestamp: item.timestamp,
      timeLabel: new Date(item.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: range === "5M" || range === "30M" ? "2-digit" : undefined,
      }),
    }));

    return NextResponse.json({
      success: true,
      startupId,
      range,
      currentPrice: startup.currentPrice,
      openPrice: startup.openPrice,
      data: formattedData,
    });
  } catch (error: any) {
    console.error("Chart API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch price chart." },
      { status: 500 }
    );
  }
}
