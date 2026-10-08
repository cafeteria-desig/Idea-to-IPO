import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { executeOrder } from "@/lib/trading/engine";
import { invalidateCache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();

    const targetUserId = user?.id || body.userId;
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: Please log in to trade." },
        { status: 401 }
      );
    }

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

    const numQty = Number(quantity);
    if (!numQty || isNaN(numQty) || numQty <= 0) {
      return NextResponse.json(
        { success: false, message: "Order quantity must be a positive number." },
        { status: 400 }
      );
    }

    const numPrice = price !== undefined && price !== null ? Number(price) : undefined;
    if (type === "LIMIT" && (!numPrice || isNaN(numPrice) || numPrice <= 0)) {
      return NextResponse.json(
        { success: false, message: "Limit orders require a valid price." },
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

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Trade Order API Error:", error);
    const message = error.message || "Failed to execute order.";
    const isValidationErr =
      message.includes("Insufficient") ||
      message.includes("suspended") ||
      message.includes("not open") ||
      message.includes("CLOSED") ||
      message.includes("positive");

    return NextResponse.json(
      { success: false, message },
      { status: isValidationErr ? 400 : 500 }
    );
  }
}
