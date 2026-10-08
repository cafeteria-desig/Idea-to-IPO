import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cacheKey = "startups:all";
    const cached = getCached<any[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const [rawStartups, holdingSums] = await Promise.all([
      prisma.startup.findMany({
        orderBy: { pitchOrder: "asc" },
      }),
      prisma.holding.groupBy({
        by: ["startupId"],
        _sum: { quantity: true },
        where: {
          user: {
            role: { not: "ADMIN" },
          },
        },
      }),
    ]);

    const holdingMap = new Map<string, number>();
    for (const h of holdingSums) {
      holdingMap.set(h.startupId, h._sum.quantity || 0);
    }

    const startups = rawStartups.map((s) => {
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

    setCached(cacheKey, startups, 1500);
    return NextResponse.json(startups);
  } catch (error) {
    console.error("Startups API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch startups" },
      { status: 500 }
    );
  }
}
