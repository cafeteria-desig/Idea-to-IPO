import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { executeOrder } from "@/lib/trading/engine";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Please log in to trade." },
        { status: 401 }
      );
    }

    if (user.role === "STARTUP") {
      return NextResponse.json(
        { success: false, message: "Company founder accounts cannot trade stocks on the exchange." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = user.id; // Anti-IDOR: strictly enforce authenticated user ID

    const { startupId, side, type, quantity, price } = body;

    if (!startupId) {
      return NextResponse.json(
        { success: false, message: "Startup / Stock ID is required." },
        { status: 400 }
      );
    }

    if (side !== "BUY" && side !== "SELL") {
      return NextResponse.json(
        { success: false, message: "Order side must be either BUY or SELL." },
        { status: 400 }
      );
    }

    if (type !== "MARKET" && type !== "LIMIT") {
      return NextResponse.json(
        { success: false, message: "Order type must be either MARKET or LIMIT." },
        { status: 400 }
      );
    }

    const numQty = Math.floor(Number(quantity));
    if (!numQty || isNaN(numQty) || numQty <= 0) {
      return NextResponse.json(
        { success: false, message: "Order quantity must be a positive whole number." },
        { status: 400 }
      );
    }

    const numPrice = price !== undefined && price !== null ? Number(price) : undefined;
    if (type === "LIMIT" && (!numPrice || isNaN(numPrice) || numPrice <= 0)) {
      return NextResponse.json(
        { success: false, message: "Limit orders require a valid positive price." },
        { status: 400 }
      );
    }

    const result = await executeOrder({
      userId: targetUserId,
      startupId,
      side,
      type,
      quantity: numQty,
      price: numPrice,
    });

    invalidateCache();

    return NextResponse.json({
      success: true,
      message: result.message,
      orderId: result.orderId,
      status: result.status,
      filledQuantity: result.filledQuantity,
      remainingQuantity: result.remainingQuantity,
      trades: result.trades,
    });
  } catch (error: any) {
    console.error("Order API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "An error occurred while executing your order.",
      },
      { status: 400 }
    );
  }
}
