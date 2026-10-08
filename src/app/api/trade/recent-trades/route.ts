import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserDisplayIdentifier } from "@/lib/tokens";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startupId = searchParams.get("startupId");
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 25)));

    const cacheKey = `trades:${startupId || "all"}:${limit}`;
    const cached = getCached<any[]>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, trades: cached });
    }

    const whereClause: any = {};
    if (startupId) {
      whereClause.startupId = startupId;
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      include: {
        startup: { select: { id: true, name: true, slug: true } },
        buyer: { select: { id: true, name: true, email: true, role: true, token: true } },
        seller: { select: { id: true, name: true, email: true, role: true, token: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const formattedTrades = trades.map((t) => ({
      id: t.id,
      startupId: t.startupId,
      startupName: t.startup.name,
      startupSlug: t.startup.slug,
      price: t.price,
      quantity: t.quantity,
      amount: t.amount,
      buyerId: t.buyerId,
      buyerName: getUserDisplayIdentifier(t.buyer),
      sellerId: t.sellerId,
      sellerName: getUserDisplayIdentifier(t.seller),
      createdAt: t.createdAt,
    }));

    setCached(cacheKey, formattedTrades, 1500);
    return NextResponse.json({ success: true, trades: formattedTrades });
  } catch (error: any) {
    console.error("Recent Trades API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch recent trades." },
      { status: 500 }
    );
  }
}
