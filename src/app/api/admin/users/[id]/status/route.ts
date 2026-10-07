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
    const { status, reason, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (status !== "ACTIVE" && status !== "BLOCKED") {
      return NextResponse.json({ success: false, message: "Status must be ACTIVE or BLOCKED" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const userRes = await tx.user.update({
        where: { id: targetUser.id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: `SET_USER_STATUS_${status}`,
          targetType: "USER",
          targetId: targetUser.id,
          previousValue: targetUser.status,
          newValue: status,
          reason: reason || "Admin intervention",
        },
      });

      return userRes;
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Admin user status error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
