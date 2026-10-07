import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, sanitizeUser } from "@/lib/auth";
import { USER_TOKEN_MAP, getUserLoginToken } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, token, role } = body;

    let targetUser = null;

    // 1. Direct Access via 6-Digit Token
    if (token) {
      const cleanToken = String(token).trim();

      // Look up directly in database by stored random token or password
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { token: cleanToken },
            { password: cleanToken },
          ],
        },
      });

      // Fallback to token mapping
      if (!targetUser) {
        const emailMatch = Object.entries(USER_TOKEN_MAP).find(([_, tok]) => tok === cleanToken)?.[0];
        if (emailMatch) {
          targetUser = await prisma.user.findUnique({
            where: { email: emailMatch },
          });
        }
      }

      // Fallback to dynamic token resolver
      if (!targetUser) {
        const allUsers = await prisma.user.findMany();
        const matched = allUsers.find((u) => getUserLoginToken(u) === cleanToken);
        if (matched) {
          targetUser = matched;
        }
      }

      if (!targetUser) {
        return NextResponse.json(
          { success: false, message: "Invalid 6-digit token code. Please check with Event Director." },
          { status: 401 }
        );
      }
    } 
    // 2. Admin Login with password Bhavishy@2007
    else if (role === "ADMIN" || (email && String(email).toLowerCase().trim() === "admin@ideaipo.com")) {
      if (password !== "Bhavishy@2007") {
        return NextResponse.json(
          { success: false, message: "Incorrect Admin password." },
          { status: 401 }
        );
      }

      targetUser = await prisma.user.findUnique({
        where: { email: "admin@ideaipo.com" },
      });
    }
    // 3. Standard Email + Password authentication
    else {
      if (!email || !password) {
        return NextResponse.json(
          { success: false, message: "Credentials or 6-digit token required" },
          { status: 400 }
        );
      }

      targetUser = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase().trim() },
      });

      if (!targetUser || targetUser.password !== password) {
        return NextResponse.json(
          { success: false, message: "Invalid email or password" },
          { status: 401 }
        );
      }
    }

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "User account not found" },
        { status: 404 }
      );
    }

    if (targetUser.status === "BLOCKED") {
      return NextResponse.json(
        { success: false, message: "Your account is BLOCKED by administrators." },
        { status: 403 }
      );
    }

    // Update online status
    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        isOnline: true,
        lastActiveAt: new Date(),
      },
    });

    const response = NextResponse.json({
      success: true,
      user: sanitizeUser(updatedUser),
    });

    setAuthCookie(response, targetUser.id);
    return response;
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
