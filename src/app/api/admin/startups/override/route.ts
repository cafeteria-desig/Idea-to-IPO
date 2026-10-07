import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = await getAdminUser(req, body.adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const { startupId, newTotal, reason } = body;

    if (!startupId) {
      return NextResponse.json({ success: false, message: "startupId is required" }, { status: 400 });
    }

    // Validation rule (Spec §6.6): newTotal >= 0 and reason.trim().length >= 5
    if (newTotal === undefined || typeof newTotal !== "number" || newTotal < 0) {
      return NextResponse.json(
        { success: false, message: "newTotal must be a number greater than or equal to 0" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        {
          success: false,
          message: "Reason justification is mandatory and must be at least 5 characters long.",
        },
        { status: 400 }
      );
    }

    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) {
      return NextResponse.json({ success: false, message: "Startup not found" }, { status: 404 });
    }

    const previousTotal = startup.totalInvestmentReceived;

    const updatedStartup = await prisma.$transaction(async (tx) => {
      const s = await tx.startup.update({
        where: { id: startup.id },
        data: {
          totalInvestmentReceived: newTotal,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: "MANUAL_TOTAL_OVERRIDE",
          targetType: "STARTUP",
          targetId: startup.id,
          previousValue: previousTotal.toString(),
          newValue: newTotal.toString(),
          reason: reason.trim(),
        },
      });

      return s;
    });

    return NextResponse.json({
      success: true,
      startup: updatedStartup,
      message: "Startup total investment overridden successfully",
    });
  } catch (error) {
    console.error("Valuation override error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
