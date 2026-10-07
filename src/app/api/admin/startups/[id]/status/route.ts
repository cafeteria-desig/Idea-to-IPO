import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { seedMarketLiquidityForStartup } from "@/lib/trading/engine";

const VALID_STATES = [
  "COMING_UP",
  "PITCHING",
  "QA",
  "IPO_OPEN",
  "IPO_PAUSED",
  "IPO_CLOSED",
  "UNDER_REVIEW",
  "FINALIZED",
  "DISQUALIFIED",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { status, reason, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!VALID_STATES.includes(status)) {
      return NextResponse.json(
        { success: false, message: `Invalid status '${status}'` },
        { status: 400 }
      );
    }

    let startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup) {
      startup = await prisma.startup.findUnique({ where: { slug: id } });
    }
    if (!startup) {
      startup = await prisma.startup.findFirst({
        where: { OR: [{ id: `startup-${id}` }, { slug: id.replace("startup-", "") }] },
      });
    }

    if (!startup) {
      return NextResponse.json({ success: false, message: "Startup not found" }, { status: 404 });
    }

    const previousStatus = startup.ipoStatus;

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.startup.update({
        where: { id: startup.id },
        data: { ipoStatus: status },
      });

      // Update MarketState activeStartupId if entering pitching or ipo open
      if (status === "PITCHING" || status === "IPO_OPEN") {
        await tx.marketState.update({
          where: { id: "global" },
          data: { activeStartupId: startup.id },
        });
      }

      await tx.activityFeed.create({
        data: {
          type: "IPO_STATUS",
          message: `${startup.name} IPO status transitioned to ${status}`,
          startupName: startup.name,
          isPublic: true,
        },
      });

      return s;
    });

    // Ensure dynamic order book liquidity is seeded when IPO opens (outside transaction to avoid SQLite locks)
    if (status === "IPO_OPEN") {
      try {
        await seedMarketLiquidityForStartup(startup.id);
      } catch (err) {
        console.warn("Notice: Initial liquidity seeding:", err);
      }
    }

    return NextResponse.json({
      success: true,
      startup: updated,
      message: `Status updated to ${status}`,
    });
  } catch (error) {
    console.error("Startup status error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export const PATCH = POST;
