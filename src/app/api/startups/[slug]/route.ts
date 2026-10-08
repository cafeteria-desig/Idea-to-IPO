import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const lowerSlug = slug.toLowerCase();
    const cacheKey = `startup:slug:${lowerSlug}`;

    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const startup = await prisma.startup.findUnique({
      where: { slug: lowerSlug },
      include: {
        investments: {
          where: { status: "VALID" },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup not found" },
        { status: 404 }
      );
    }

    // Calculate investor held shares
    const heldAgg = await prisma.holding.aggregate({
      _sum: { quantity: true },
      where: {
        startupId: startup.id,
        user: { role: { not: "ADMIN" } },
      },
    });

    const totalHeld = heldAgg._sum.quantity || 0;
    const availableShares = Math.max(0, Math.floor(startup.totalShares - totalHeld));

    const openPrice = startup.openPrice || startup.initialPrice || 100;
    const priceChange = Number((startup.currentPrice - openPrice).toFixed(2));
    const percentageChange = Number((((startup.currentPrice - openPrice) / openPrice) * 100).toFixed(2));
    const marketCap = Number((startup.totalShares * startup.currentPrice).toFixed(2));

    const payload = {
      ...startup,
      availableShares,
      priceChange,
      percentageChange,
      marketCap,
    };

    setCached(cacheKey, payload, 1500);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Startup detail API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch startup detail" },
      { status: 500 }
    );
  }
}
