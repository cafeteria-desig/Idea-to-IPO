import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, sanitizeUser } from "@/lib/auth";
import { USER_TOKEN_MAP, getUserLoginToken } from "@/lib/tokens";
import { timingSafeCompare, checkRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 0. Anti-Brute-Force Rate Limiting (10 attempts per minute per IP)
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "client-ip";

    const rate = checkRateLimit(`login:${clientIp}`, 10, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many login attempts. For security, please wait ${rate.retryAfterSec} seconds before trying again.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { email, password, token, role } = body;

    let targetUser: any = null;

    // 1. Direct Access via 6-Digit Token (Audience, Judges, Startup Companies)
    if (token) {
      const cleanToken = String(token).trim();

      // Look up directly in User table by token or password
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [{ token: cleanToken }, { password: cleanToken }],
        },
      });

      // If not in User, check if this is a Company / Startup token
      if (!targetUser) {
        const startupWithToken = await prisma.startup.findFirst({
          where: { token: cleanToken },
        });

        if (startupWithToken) {
          // Find or auto-provision the founder account for this company
          targetUser = await prisma.user.findFirst({
            where: {
              OR: [
                { startupId: startupWithToken.id },
                { email: `founder.${startupWithToken.slug}@ideaipo.com` },
              ],
            },
          });

          if (!targetUser) {
            targetUser = await prisma.user.create({
              data: {
                name: `${startupWithToken.name} Founder`,
                email: `founder.${startupWithToken.slug}@ideaipo.com`,
                role: "STARTUP",
                status: "ACTIVE",
                token: cleanToken,
                password: cleanToken,
                startupId: startupWithToken.id,
                startingCapital: 0,
                currentBalance: 0,
                totalInvested: 0,
                isOnline: true,
              },
            });
          } else if (targetUser.token !== cleanToken) {
            targetUser = await prisma.user.update({
              where: { id: targetUser.id },
              data: { token: cleanToken, startupId: startupWithToken.id },
            });
          }
        }
      }

      // Fallback to static token registry
      if (!targetUser) {
        const emailMatch = Object.entries(USER_TOKEN_MAP).find(
          ([_, tok]) => tok === cleanToken
        )?.[0];
        if (emailMatch) {
          targetUser = await prisma.user.findUnique({
            where: { email: emailMatch },
          });
        }
      }

      // Fallback to dynamic token generator
      if (!targetUser) {
        const allUsers = await prisma.user.findMany();
        const matched = allUsers.find((u) => getUserLoginToken(u) === cleanToken);
        if (matched) {
          targetUser = matched;
        }
      }

      if (!targetUser) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid 6-digit token code. Please check with Event Registration Desk.",
          },
          { status: 401 }
        );
      }
    }
    // 2. Admin Login with password (Timing-safe comparison against Bhavishy@2007)
    else if (
      role === "ADMIN" ||
      (email && String(email).toLowerCase().trim() === "admin@ideaipo.com")
    ) {
      const cleanPass = typeof password === "string" ? password : "";
      const validAdmin = timingSafeCompare(cleanPass, "Bhavishy@2007");

      if (!validAdmin) {
        return NextResponse.json(
          { success: false, message: "Incorrect Admin password." },
          { status: 401 }
        );
      }

      targetUser = await prisma.user.findUnique({
        where: { email: "admin@ideaipo.com" },
      });

      if (!targetUser) {
        // Auto-provision default admin if missing
        targetUser = await prisma.user.create({
          data: {
            id: "user-admin",
            name: "Event Director",
            email: "admin@ideaipo.com",
            password: "Bhavishy@2007",
            role: "ADMIN",
            status: "ACTIVE",
            startingCapital: 0,
            currentBalance: 0,
            totalInvested: 0,
            isOnline: true,
          },
        });
      }
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

      if (!targetUser || !timingSafeCompare(targetUser.password, String(password))) {
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
        { success: false, message: "Your account is BLOCKED by event administrators." },
        { status: 403 }
      );
    }

    // =========================================================================
    // SECURITY UPDATE: SESSION MANAGEMENT
    // 1. Single login per token: Token holders (RETAIL, FII, STARTUP) have their
    //    activeSessionId rotated to a new UUID. Any existing session on another
    //    tab/device becomes immediately invalid!
    // 2. Admin exception: Admin role allows unlimited simultaneous logins.
    //    activeSessionId is NOT overwritten for admins so multiple people with
    //    the password can manage the system simultaneously!
    // =========================================================================
    let assignedSessionId: string;
    let updatedUser: any;

    if (targetUser.role === "ADMIN") {
      // Multiple concurrent admin logins supported
      assignedSessionId = `admin-${crypto.randomUUID()}`;
      updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          isOnline: true,
          lastActiveAt: new Date(),
        },
      });
    } else {
      // Strictly ONE active login session per token
      assignedSessionId = crypto.randomUUID();
      updatedUser = await prisma.user.update({
        where: { id: targetUser.id },
        data: {
          activeSessionId: assignedSessionId,
          sessionCreatedAt: new Date(),
          isOnline: true,
          lastActiveAt: new Date(),
        },
      });
    }

    let startupInfo: { id: string; name: string; slug: string } | null = null;
    if (updatedUser.startupId) {
      const s = await prisma.startup.findUnique({
        where: { id: updatedUser.startupId },
        select: { id: true, name: true, slug: true },
      });
      if (s) startupInfo = s;
    }

    const safeUser = sanitizeUser(updatedUser, startupInfo);

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      startup: startupInfo,
      sessionId: assignedSessionId,
    });

    const sessionToken = setAuthCookie(
      response,
      targetUser.id,
      targetUser.role,
      assignedSessionId
    );

    // Also include sessionToken in response JSON for clients using token headers
    return NextResponse.json({
      success: true,
      user: safeUser,
      startup: startupInfo,
      sessionId: assignedSessionId,
      sessionToken,
    }, {
      headers: response.headers,
    });
  } catch (error: any) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
