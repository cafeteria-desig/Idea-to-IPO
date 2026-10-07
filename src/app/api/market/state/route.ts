import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const marketState = await prisma.marketState.findUnique({
      where: { id: "global" },
    });

    if (!marketState) {
      return NextResponse.json({
        id: "global",
        isMarketActive: true,
        activeStartupId: null,
        hideInvestorNamesPublicly: false,
        bannerMessage: null,
      });
    }

    return NextResponse.json(marketState);
  } catch (error) {
    return NextResponse.json(
      { id: "global", isMarketActive: true },
      { status: 500 }
    );
  }
}
