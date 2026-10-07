import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { seedMarketLiquidityForStartup } from "@/lib/trading/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const startups = await prisma.startup.findMany({
      orderBy: { pitchOrder: "asc" },
      include: {
        _count: {
          select: {
            orders: true,
            trades: true,
            holdings: true,
            investments: true,
          },
        },
      },
    });

    return NextResponse.json(startups);
  } catch (error) {
    console.error("Admin startups GET error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      name,
      idea,
      pitchSummary,
      tagLine,
      industry,
      fundingAsk,
      shareValue,
      initialPrice,
      equityOffered,
      valuation,
      totalShares,
      pitchOrder,
      problem,
      solution,
      businessModel,
      targetMarket,
      ipoStatus,
      founderName,
      teamMembers,
      logoUrl,
      pitchDeckUrl,
      adminId,
    } = body;

    const effectiveAdminId = adminId || req.nextUrl.searchParams.get("adminId") || req.headers.get("x-user-id");
    const admin = await getAdminUser(req, effectiveAdminId || undefined);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Only administrators can register startup teams." },
        { status: 403 }
      );
    }

    // 1. Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Team / Startup Name is required." },
        { status: 400 }
      );
    }

    const coreIdea = (idea || pitchSummary || "").trim();
    if (!coreIdea) {
      return NextResponse.json(
        { success: false, message: "Startup Idea / Pitch summary is required." },
        { status: 400 }
      );
    }

    const parsedAsk = Number(fundingAsk);
    if (isNaN(parsedAsk) || parsedAsk <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid Funding Ask amount (₹) is required." },
        { status: 400 }
      );
    }

    const parsedPrice = Number(shareValue || initialPrice || 100);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid Share Value / Price (₹) is required." },
        { status: 400 }
      );
    }

    const parsedEquity = equityOffered ? Number(equityOffered) : 10;
    const computedValuation = valuation && Number(valuation) > 0
      ? Number(valuation)
      : Math.round(parsedAsk / (parsedEquity / 100));

    const computedShares = totalShares && Number(totalShares) > 0
      ? Number(totalShares)
      : Math.max(1000, Math.round(computedValuation / parsedPrice));

    // 2. Generate slug
    let baseSlug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseSlug) {
      baseSlug = `team-${Date.now()}`;
    }

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.startup.findUnique({ where: { slug } })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    // 3. Determine pitch order
    let finalOrder = Number(pitchOrder);
    if (!finalOrder || isNaN(finalOrder) || finalOrder <= 0) {
      const highest = await prisma.startup.findFirst({
        orderBy: { pitchOrder: "desc" },
        select: { pitchOrder: true },
      });
      finalOrder = (highest?.pitchOrder || 0) + 1;
    }

    const finalTagline = (tagLine || coreIdea.slice(0, 100)).trim();
    const finalIndustry = (industry || "Technology & Innovation").trim();
    const finalProblem = (problem || coreIdea).trim();
    const finalSolution = (solution || coreIdea).trim();
    const finalStatus = ipoStatus || "IPO_OPEN";

    // 4. Create startup in DB
    const startupId = `startup-${slug}`;
    const newStartup = await prisma.startup.create({
      data: {
        id: startupId,
        name: name.trim(),
        slug,
        tagLine: finalTagline,
        industry: finalIndustry,
        problem: finalProblem,
        solution: finalSolution,
        businessModel: (businessModel || "B2B / B2C Revenue Generation & Scalable Unit Economics").trim(),
        targetMarket: (targetMarket || "Domestic & International Enterprise/Consumer Markets").trim(),
        fundingAsk: parsedAsk,
        equityOffered: parsedEquity,
        pitchSummary: coreIdea,
        pitchDeckUrl: pitchDeckUrl?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        teamMembers: typeof teamMembers === "string" && teamMembers.trim()
          ? teamMembers.trim()
          : JSON.stringify([
              {
                name: (founderName || `${name.trim()} Core Team`).trim(),
                role: "Founder / Lead Presenter",
                avatar: "",
                bio: `Pioneering ${name.trim()}`,
              },
            ]),
        pitchOrder: finalOrder,
        ipoStatus: finalStatus,
        initialPrice: parsedPrice,
        currentPrice: parsedPrice,
        previousPrice: parsedPrice,
        openPrice: parsedPrice,
        dayHigh: parsedPrice,
        dayLow: parsedPrice,
        totalShares: computedShares,
        initialValuation: computedValuation,
        totalInvestmentReceived: 0,
        retailInvestment: 0,
        fiiInvestment: 0,
        investorCount: 0,
        totalVolume: 0,
        isSuspended: false,
      },
    });

    // 5. Non-blocking background post-processing (liquidity seeding, audit logs, activity feed)
    (async () => {
      try {
        if (newStartup.ipoStatus === "IPO_OPEN") {
          await seedMarketLiquidityForStartup(newStartup.id);
        }
        const ms = await prisma.marketState.findUnique({ where: { id: "global" } });
        if (!ms?.activeStartupId) {
          await prisma.marketState.upsert({
            where: { id: "global" },
            update: { activeStartupId: newStartup.id },
            create: { id: "global", isMarketActive: true, activeStartupId: newStartup.id },
          });
        }
        await prisma.auditLog.create({
          data: {
            adminId: admin.id,
            adminName: admin.name,
            action: "REGISTER_STARTUP",
            targetType: "STARTUP",
            targetId: newStartup.id,
            reason: `Registered pitch #${newStartup.pitchOrder} ${newStartup.name} (${newStartup.industry}) | Ask: ₹${newStartup.fundingAsk} | Share Value: ₹${newStartup.currentPrice} | Status: ${newStartup.ipoStatus}`,
          },
        });
        await prisma.activityFeed.create({
          data: {
            type: "IPO_STATUS",
            message: `New venture registered: ${newStartup.name} (Pitch #${newStartup.pitchOrder}) is now ready!`,
            startupName: newStartup.name,
            isPublic: true,
          },
        });
      } catch (bgErr) {
        console.warn("Background registration post-processing notice:", bgErr);
      }
    })();

    return NextResponse.json({
      success: true,
      message: `Team "${newStartup.name}" successfully registered and live on the exchange!`,
      startup: newStartup,
    });
  } catch (error: any) {
    console.error("Admin register startup error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to register startup team" },
      { status: 500 }
    );
  }
}
