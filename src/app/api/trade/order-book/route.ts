import { NextRequest, NextResponse } from "next/server";
import { getOrderBook } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startupId = searchParams.get("startupId");

    if (!startupId) {
      return NextResponse.json(
        { success: false, message: "startupId query parameter is required." },
        { status: 400 }
      );
    }

    const orderBook = await getOrderBook(startupId);
    return NextResponse.json(orderBook);
  } catch (error: any) {
    console.error("Order Book API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch order book." },
      { status: 500 }
    );
  }
}
