import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = await getAdminUser(req, body.adminId);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin access required." },
        { status: 403 }
      );
    }

    const { id: startupId } = params;
    const { isSuspended, reason } = body;

    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup not found." },
        { status: 404 }
      );
    }

    const nextState = isSuspended !== undefined ? Boolean(isSuspended) : !startup.isSuspended;

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.startup.update({
        where: { id: startupId },
        data: { isSuspended: nextState },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: nextState ? "SUSPEND_STOCK" : "ACTIVATE_STOCK",
          targetType: "STARTUP",
          targetId: startup.id,
          previousValue: String(startup.isSuspended),
          newValue: String(nextState),
          reason: reason || (nextState ? "Admin suspended stock trading" : "Admin restored stock trading"),
        },
      });

      await tx.activityFeed.create({
        data: {
          type: "ADMIN_ACTION",
          message: nextState
            ? `Trading in ${startup.name} has been SUSPENDED by event director.`
            : `Trading in ${startup.name} has been RESUMED.`,
          startupName: startup.name,
          isPublic: true,
        },
      });

      return s;
    });

    return NextResponse.json({
      success: true,
      isSuspended: updated.isSuspended,
      message: updated.isSuspended
        ? `Stock ${startup.name} is now suspended.`
        : `Stock ${startup.name} is now active.`,
    });
  } catch (error: any) {
    console.error("Stock Suspend Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update stock suspension." },
      { status: 500 }
    );
  }
}
