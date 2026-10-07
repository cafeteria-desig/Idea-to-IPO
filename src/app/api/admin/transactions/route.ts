import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access required" }, { status: 403 });
    }

    const transactions = await prisma.investment.findMany({
      include: {
        startup: {
          select: {
            id: true,
            name: true,
            slug: true,
            industry: true,
          },
        },
        investor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Admin transactions API error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
