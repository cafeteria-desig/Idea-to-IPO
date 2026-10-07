import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, clearAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isOnline: false },
      });
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    clearAuthCookie(response);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    const response = NextResponse.json({ success: true });
    clearAuthCookie(response);
    return response;
  }
}
