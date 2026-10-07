import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { newCapital, reason, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (newCapital === undefined || typeof newCapital !== "number" || newCapital < 0) {
      return NextResponse.json({ success: false, message: "Invalid capital value" }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ success: false, message: "Reason is mandatory" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const delta = newCapital - targetUser.startingCapital;
    const newBalance = Math.max(0, targetUser.currentBalance + delta);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update user
      const updated = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          startingCapital: newCapital,
          currentBalance: newBalance,
        },
      });

      // 2. Create CapitalAdjustment record
      const adjustment = await tx.capitalAdjustment.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          userId: targetUser.id,
          userName: targetUser.name,
          previousCapital: targetUser.startingCapital,
          newCapital: newCapital,
          previousBalance: targetUser.currentBalance,
          newBalance: newBalance,
          reason: reason.trim(),
        },
      });

      // 3. Create AuditLog entry
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: "ADJUST_CAPITAL",
          targetType: "USER",
          targetId: targetUser.id,
          previousValue: JSON.stringify({
            startingCapital: targetUser.startingCapital,
            currentBalance: targetUser.currentBalance,
          }),
          newValue: JSON.stringify({
            startingCapital: newCapital,
            currentBalance: newBalance,
          }),
          reason: reason.trim(),
        },
      });

      return { updated, adjustment };
    });

    return NextResponse.json({
      success: true,
      user: result.updated,
      adjustment: result.adjustment,
      message: "Capital adjusted successfully",
    });
  } catch (error) {
    console.error("Capital adjustment error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
