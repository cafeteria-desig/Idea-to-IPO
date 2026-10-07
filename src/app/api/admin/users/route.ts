import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser, sanitizeUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAdminUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access required" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        token: true,
        role: true,
        status: true,
        startingCapital: true,
        currentBalance: true,
        totalInvested: true,
        isOnline: true,
        lastActiveAt: true,
        startupId: true,
        createdAt: true,
        holdings: {
          select: {
            startupId: true,
            quantity: true,
            averageBuyPrice: true,
            totalInvested: true,
            realizedPnL: true,
          },
        },
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Admin users API error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, password, token, role, startingCapital, phone, startupId, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Only administrators can create accounts" },
        { status: 403 }
      );
    }

    // Validate presence of required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Full name is required" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, message: "Email address is required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    const validRoles = ["ADMIN", "FII", "RETAIL", "STARTUP"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, message: `Role must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "An account with this email address already exists" },
        { status: 409 }
      );
    }

    // Generate or validate unique random 6-digit token for non-admin users
    let assignedToken: string | null = null;
    if (role !== "ADMIN") {
      let candidateToken = token ? String(token).trim() : "";
      if (!candidateToken || !/^\d{6}$/.test(candidateToken)) {
        // Automatically generate a random unique 6-digit token
        let isUnique = false;
        while (!isUnique) {
          candidateToken = String(Math.floor(100000 + Math.random() * 900000));
          const existingTokenUser = await prisma.user.findFirst({
            where: { token: candidateToken },
          });
          if (!existingTokenUser) {
            isUnique = true;
          }
        }
      } else {
        // If candidate token supplied, ensure it is unique; if collision, re-randomize
        const existingTokenUser = await prisma.user.findFirst({
          where: { token: candidateToken },
        });
        if (existingTokenUser) {
          let isUnique = false;
          while (!isUnique) {
            candidateToken = String(Math.floor(100000 + Math.random() * 900000));
            const u = await prisma.user.findFirst({ where: { token: candidateToken } });
            if (!u) isUnique = true;
          }
        }
      }
      assignedToken = candidateToken;
    }

    // Determine initial password
    let finalPassword = password && typeof password === "string" && password.trim() ? password.trim() : (assignedToken || "ipo2026");
    if (role === "ADMIN" && (!password || password.trim().length < 3)) {
      finalPassword = "Bhavishy@2007";
    }

    // Calculate capital based on role or explicit input
    let capitalAmount = 0;
    if (typeof startingCapital === "number" && !isNaN(startingCapital)) {
      capitalAmount = Math.max(0, startingCapital);
    } else if (startingCapital && !isNaN(Number(startingCapital))) {
      capitalAmount = Math.max(0, Number(startingCapital));
    } else {
      if (role === "FII") capitalAmount = 10000000; // 1 Cr
      else if (role === "RETAIL") capitalAmount = 500000; // 5 Lakhs
      else capitalAmount = 0;
    }

    // Check optional startup linkage
    let linkedStartupId: string | null = null;
    if (role === "STARTUP" && startupId) {
      const foundStartup = await prisma.startup.findUnique({ where: { id: startupId } });
      if (foundStartup) {
        linkedStartupId = foundStartup.id;
      }
    }

    // Create user in DB
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: trimmedEmail,
        password: finalPassword,
        token: assignedToken,
        role: role,
        phone: phone ? String(phone).trim() : null,
        startupId: linkedStartupId,
        startingCapital: capitalAmount,
        currentBalance: capitalAmount,
        totalInvested: 0,
        status: "ACTIVE",
        isOnline: false,
      },
    });

    // Record immutable audit log
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminName: admin.name,
        action: "CREATE_USER",
        targetType: "USER",
        targetId: newUser.id,
        newValue: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          startingCapital: capitalAmount,
          startupId: linkedStartupId,
        }),
        reason: `Provisioned ${role} account (${newUser.email}) by Administrator ${admin.name}`,
      },
    });

    // Feed event
    await prisma.activityFeed.create({
      data: {
        type: "USER_JOINED",
        message: `${newUser.name} provisioned as ${newUser.role} by Event Director`,
        investorName: newUser.name,
        isPublic: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: sanitizeUser(newUser),
      token: assignedToken,
      message: `Account for ${newUser.name} created successfully.`,
    });
  } catch (error) {
    console.error("Admin user creation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error creating account" },
      { status: 500 }
    );
  }
}
