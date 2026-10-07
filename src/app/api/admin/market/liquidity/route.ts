import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedMarketLiquidityForStartup } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = await getAdminUser(req, body.adminId);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin access required." },
        { status: 403 }
      );
    }

    const { startupId } = body;
    if (!startupId) {
      // Seed all open startups
      const openStartups = await prisma.startup.findMany({
        where: { ipoStatus: "IPO_OPEN" },
      });
      for (const s of openStartups) {
        await seedMarketLiquidityForStartup(s.id);
      }
      return NextResponse.json({
        success: true,
        message: `Order book liquidity injected across ${openStartups.length} active startups.`,
      });
    }

    await seedMarketLiquidityForStartup(startupId);
    return NextResponse.json({
      success: true,
      message: "Order book liquidity injected successfully.",
    });
  } catch (error: any) {
    console.error("Liquidity Injection Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to inject liquidity." },
      { status: 500 }
    );
  }
}
