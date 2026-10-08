import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cacheKey = "market:state";
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const marketState = await prisma.marketState.findUnique({
      where: { id: "global" },
    });

    const payload = marketState || {
      id: "global",
      isMarketActive: true,
      activeStartupId: null,
      hideInvestorNamesPublicly: false,
      bannerMessage: null,
    };

    setCached(cacheKey, payload, 2000);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { id: "global", isMarketActive: true },
      { status: 500 }
    );
  }
}
