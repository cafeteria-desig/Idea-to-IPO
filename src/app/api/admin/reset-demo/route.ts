import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { seedDatabase } from "../../../../../prisma/seed";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = await getAdminUser(req, body.adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    await seedDatabase();

    return NextResponse.json({
      success: true,
      message: "Database demo data successfully reset to clean baseline.",
    });
  } catch (error) {
    console.error("Reset demo error:", error);
    return NextResponse.json({ success: false, message: "Failed to reset demo database" }, { status: 500 });
  }
}
