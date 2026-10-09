import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { seedMarketLiquidityForStartup } from "@/lib/trading/engine";
import { invalidateCache } from "@/lib/cache";

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
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Only authenticated administrators can register startup teams." },
        { status: 403 }
      );
    }

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
      token: customToken,
    } = body;

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

    const parsedPrice = Number(shareValue || initialPrice || 100);
    const validPrice = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 100;

    const parsedShares = Number(totalShares);
    const validShares = !isNaN(parsedShares) && parsedShares > 0 ? Math.floor(parsedShares) : 1000000;

    const parsedValuation = Number(valuation);
    const validValuation = !isNaN(parsedValuation) && parsedValuation > 0
      ? parsedValuation
      : Math.round(validShares * validPrice);

    const parsedAsk = Number(fundingAsk);
    const validAsk = !isNaN(parsedAsk) && parsedAsk > 0
      ? parsedAsk
      : Math.round(validValuation * 0.1);

    const parsedEquity = equityOffered ? Number(equityOffered) : 10;
    const computedValuation = validValuation;
    const computedShares = validShares;

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

    // 3. Generate or validate unique 6-digit access token for this company / idea
    let startupToken = customToken ? String(customToken).trim() : "";
    if (!startupToken || !/^\d{6}$/.test(startupToken)) {
      let isUnique = false;
      while (!isUnique) {
        startupToken = String(Math.floor(100000 + Math.random() * 900000));
        const [existingStartup, existingUser] = await Promise.all([
          prisma.startup.findUnique({ where: { token: startupToken } }),
          prisma.user.findFirst({ where: { token: startupToken } }),
        ]);
        if (!existingStartup && !existingUser) {
          isUnique = true;
        }
      }
    } else {
      // Validate uniqueness if supplied
      const [existingStartup, existingUser] = await Promise.all([
        prisma.startup.findUnique({ where: { token: startupToken } }),
        prisma.user.findFirst({ where: { token: startupToken } }),
      ]);
      if (existingStartup || existingUser) {
        let isUnique = false;
        while (!isUnique) {
          startupToken = String(Math.floor(100000 + Math.random() * 900000));
          const [s, u] = await Promise.all([
            prisma.startup.findUnique({ where: { token: startupToken } }),
            prisma.user.findFirst({ where: { token: startupToken } }),
          ]);
          if (!s && !u) isUnique = true;
        }
      }
    }

    // 4. Determine pitch order
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

    // 5. Create startup in DB with dedicated Token Number
    const startupId = `startup-${slug}`;
    const newStartup = await prisma.startup.create({
      data: {
        id: startupId,
        name: name.trim(),
        slug,
        token: startupToken,
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

    // 6. Auto-provision founder login account linked to this token & company
    const founderEmail = `founder.${slug}@ideaipo.com`;
    try {
      await prisma.user.upsert({
        where: { email: founderEmail },
        update: {
          name: founderName ? `${founderName.trim()} (${newStartup.name})` : `${newStartup.name} Founder`,
          token: startupToken,
          password: startupToken,
          startupId: newStartup.id,
          role: "STARTUP",
          status: "ACTIVE",
        },
        create: {
          name: founderName ? `${founderName.trim()} (${newStartup.name})` : `${newStartup.name} Founder`,
          email: founderEmail,
          password: startupToken,
          token: startupToken,
          role: "STARTUP",
          status: "ACTIVE",
          startupId: newStartup.id,
          startingCapital: 0,
          currentBalance: 0,
          totalInvested: 0,
          isOnline: false,
        },
      });
    } catch (uErr) {
      console.warn("Founder account provisioning note:", uErr);
    }

    // 7. Non-blocking background post-processing (liquidity seeding, audit logs, activity feed)
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
            reason: `Registered pitch #${newStartup.pitchOrder} ${newStartup.name} (${newStartup.industry}) | Token: #${startupToken} | Ask: ₹${newStartup.fundingAsk} | Share Value: ₹${newStartup.currentPrice} | Status: ${newStartup.ipoStatus}`,
          },
        });
        await prisma.activityFeed.create({
          data: {
            type: "IPO_STATUS",
            message: `New venture registered: ${newStartup.name} (Pitch #${newStartup.pitchOrder}, Token #${startupToken}) is now ready!`,
            startupName: newStartup.name,
            isPublic: true,
          },
        });
      } catch (bgErr) {
        console.warn("Background registration post-processing notice:", bgErr);
      }
    })();

    invalidateCache();

    return NextResponse.json({
      success: true,
      message: `Team "${newStartup.name}" successfully registered with Company Token #${startupToken}!`,
      startup: newStartup,
      token: startupToken,
    });
  } catch (error: any) {
    console.error("Admin register startup error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to register startup team" },
      { status: 500 }
    );
  }
}
