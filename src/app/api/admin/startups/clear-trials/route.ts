import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = await getAdminUser(req, body.adminId);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    // Wipe all activity feeds, orders, trades, holdings, investments, priceHistory, awards, and startups
    await prisma.$transaction(async (tx) => {
      await tx.activityFeed.deleteMany({});
      await tx.trade.deleteMany({});
      await tx.order.deleteMany({});
      await tx.holding.deleteMany({});
      await tx.investment.deleteMany({});
      await tx.priceHistory.deleteMany({});
      await tx.finalAward.deleteMany({});
      await tx.watchlist.deleteMany({});
      await tx.user.updateMany({ data: { startupId: null } });
      await tx.startup.deleteMany({});
      await tx.marketState.upsert({
        where: { id: "global" },
        update: { activeStartupId: null },
        create: { id: "global", isMarketActive: true, activeStartupId: null, bannerMessage: "Welcome to IDEA TO IPO" },
      });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: "CLEAR_TRIAL_TEAMS",
          targetType: "STARTUP",
          targetId: "ALL_STARTUPS",
          reason: "Admin purged all trial teams and associated market transactions.",
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "All trial startup teams and transactions have been completely purged.",
    });
  } catch (error: any) {
    console.error("Clear trials error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to purge trial teams" },
      { status: 500 }
    );
  }
}
