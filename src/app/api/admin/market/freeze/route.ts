import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { isMarketActive, reason, activeStartupId, hideInvestorNamesPublicly, bannerMessage, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (isMarketActive === undefined || typeof isMarketActive !== "boolean") {
      return NextResponse.json(
        { success: false, message: "isMarketActive (boolean) is required" },
        { status: 400 }
      );
    }

    const previous = await prisma.marketState.findUnique({ where: { id: "global" } });

    const updated = await prisma.$transaction(async (tx) => {
      const state = await tx.marketState.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          isMarketActive,
          activeStartupId: activeStartupId ?? null,
          hideInvestorNamesPublicly: hideInvestorNamesPublicly ?? false,
          bannerMessage: bannerMessage ?? null,
        },
        update: {
          isMarketActive,
          ...(activeStartupId !== undefined ? { activeStartupId } : {}),
          ...(hideInvestorNamesPublicly !== undefined ? { hideInvestorNamesPublicly } : {}),
          ...(bannerMessage !== undefined ? { bannerMessage } : {}),
        },
      });

      const action = isMarketActive ? "RESUME_MARKET" : "FREEZE_MARKET";

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action,
          targetType: "MARKET",
          targetId: "global",
          previousValue: JSON.stringify(previous || {}),
          newValue: JSON.stringify(state),
          reason: reason || (isMarketActive ? "Admin resumed market" : "Admin froze market"),
        },
      });

      await tx.activityFeed.create({
        data: {
          type: "ADMIN_ACTION",
          message: isMarketActive
            ? "MARKET RESUMED: Bidding floor is officially OPEN."
            : "EMERGENCY FREEZE: The entire market has been PAUSED by event directors.",
          isPublic: true,
        },
      });

      return state;
    });

    return NextResponse.json({
      success: true,
      marketState: updated,
      message: updated.isMarketActive ? "Market is now ACTIVE" : "Market is now FROZEN",
    });
  } catch (error) {
    console.error("Market freeze error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
