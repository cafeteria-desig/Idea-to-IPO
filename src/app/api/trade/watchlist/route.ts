import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const items = await prisma.watchlist.findMany({
      where: { userId },
      include: {
        startup: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = items.map((w) => {
      const openPrice = w.startup.openPrice || w.startup.initialPrice || 100;
      const priceChange = Number((w.startup.currentPrice - openPrice).toFixed(2));
      const percentageChange = Number((((w.startup.currentPrice - openPrice) / openPrice) * 100).toFixed(2));

      return {
        id: w.id,
        startupId: w.startupId,
        name: w.startup.name,
        slug: w.startup.slug,
        logoUrl: w.startup.logoUrl,
        industry: w.startup.industry,
        currentPrice: w.startup.currentPrice,
        priceChange,
        percentageChange,
      };
    });

    return NextResponse.json({ success: true, watchlist: formatted });
  } catch (error: any) {
    console.error("Watchlist GET Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch watchlist." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const userId = user?.id || body.userId;
    const { startupId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    if (!startupId) {
      return NextResponse.json(
        { success: false, message: "startupId is required." },
        { status: 400 }
      );
    }

    // Toggle watchlist item
    const existing = await prisma.watchlist.findUnique({
      where: { userId_startupId: { userId, startupId } },
    });

    if (existing) {
      await prisma.watchlist.delete({
        where: { id: existing.id },
      });
      return NextResponse.json({
        success: true,
        inWatchlist: false,
        message: "Removed from Watchlist.",
      });
    } else {
      await prisma.watchlist.create({
        data: { userId, startupId },
      });
      return NextResponse.json({
        success: true,
        inWatchlist: true,
        message: "Added to Watchlist.",
      });
    }
  } catch (error: any) {
    console.error("Watchlist POST Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update watchlist." },
      { status: 500 }
    );
  }
}
