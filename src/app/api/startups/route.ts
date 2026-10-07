import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rawStartups = await prisma.startup.findMany({
      orderBy: { pitchOrder: "asc" },
    });

    const startups = rawStartups.map((s) => {
      const openPrice = s.openPrice || s.initialPrice || 100;
      const priceChange = Number((s.currentPrice - openPrice).toFixed(2));
      const percentageChange = Number((((s.currentPrice - openPrice) / openPrice) * 100).toFixed(2));
      const marketCap = Number((s.totalShares * s.currentPrice).toFixed(2));

      return {
        ...s,
        priceChange,
        percentageChange,
        marketCap,
      };
    });

    return NextResponse.json(startups);
  } catch (error) {
    console.error("Startups API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch startups" },
      { status: 500 }
    );
  }
}
