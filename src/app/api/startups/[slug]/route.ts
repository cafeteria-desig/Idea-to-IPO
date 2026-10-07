import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const startup = await prisma.startup.findUnique({
      where: { slug: slug.toLowerCase() },
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

    const openPrice = startup.openPrice || startup.initialPrice || 100;
    const priceChange = Number((startup.currentPrice - openPrice).toFixed(2));
    const percentageChange = Number((((startup.currentPrice - openPrice) / openPrice) * 100).toFixed(2));
    const marketCap = Number((startup.totalShares * startup.currentPrice).toFixed(2));

    return NextResponse.json({
      ...startup,
      priceChange,
      percentageChange,
      marketCap,
    });
  } catch (error) {
    console.error("Startup detail API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch startup detail" },
      { status: 500 }
    );
  }
}
