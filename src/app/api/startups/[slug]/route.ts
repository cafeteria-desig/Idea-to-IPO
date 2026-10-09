import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCached, setCached } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const lowerSlug = slug.toLowerCase();
    const currentUser = await getCurrentUser(req);

    const startup = await prisma.startup.findUnique({
      where: { slug: lowerSlug },
      include: {
        investments: {
          where: { status: "VALID" },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup not found" },
        { status: 404 }
      );
    }

    // =========================================================================
    // SECURITY POLICY: Company / Founder Scoping
    // "on that company's page show only that particular Company's stats only"
    // If a STARTUP user is logged in, they are restricted to THEIR OWN company!
    // =========================================================================
    if (currentUser && currentUser.role === "STARTUP") {
      const isMyStartup =
        currentUser.startupId === startup.id ||
        (currentUser.token && currentUser.token === startup.token);

      if (!isMyStartup && currentUser.startupId) {
        const myStartup = await prisma.startup.findUnique({
          where: { id: currentUser.startupId },
          select: { slug: true, name: true },
        });

        return NextResponse.json(
          {
            success: false,
            isRestricted: true,
            message:
              "Access Restricted: As a company founder, you are permitted to view only your own company's performance stats.",
            myStartupSlug: myStartup?.slug || null,
            myStartupName: myStartup?.name || null,
          },
          { status: 403 }
        );
      }
    }

    // Calculate investor held shares
    const heldAgg = await prisma.holding.aggregate({
      _sum: { quantity: true },
      where: {
        startupId: startup.id,
        user: { role: { not: "ADMIN" } },
      },
    });

    const totalHeld = heldAgg._sum.quantity || 0;
    const availableShares = Math.max(0, Math.floor(startup.totalShares - totalHeld));

    const openPrice = startup.openPrice || startup.initialPrice || 100;
    const priceChange = Number((startup.currentPrice - openPrice).toFixed(2));
    const percentageChange = Number((((startup.currentPrice - openPrice) / openPrice) * 100).toFixed(2));
    const marketCap = Number((startup.totalShares * startup.currentPrice).toFixed(2));

    const payload = {
      ...startup,
      token: startup.token,
      availableShares,
      priceChange,
      percentageChange,
      marketCap,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Startup detail API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch startup detail" },
      { status: 500 }
    );
  }
}
