import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const userId = user?.id || searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const statusFilter = searchParams.get("status"); // "OPEN", "COMPLETED", "CANCELLED", "ALL"
    const startupId = searchParams.get("startupId");

    const whereClause: any = { userId };
    if (startupId) {
      whereClause.startupId = startupId;
    }

    if (statusFilter === "OPEN") {
      whereClause.status = { in: ["OPEN", "PARTIALLY_FILLED"] };
    } else if (statusFilter === "COMPLETED") {
      whereClause.status = "FILLED";
    } else if (statusFilter === "CANCELLED") {
      whereClause.status = { in: ["CANCELLED", "REJECTED"] };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        startup: { select: { id: true, name: true, slug: true, logoUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      userId: o.userId,
      startupId: o.startupId,
      startupName: o.startup.name,
      startupSlug: o.startup.slug,
      side: o.side,
      type: o.type,
      price: o.price,
      quantity: o.quantity,
      filledQuantity: o.filledQuantity,
      remainingQuantity: o.remainingQuantity,
      status: o.status,
      reservedAmount: o.reservedAmount,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return NextResponse.json({ success: true, orders: formattedOrders });
  } catch (error: any) {
    console.error("Orders API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
