import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { formatINR } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const awards = await prisma.finalAward.findMany();
    const startups = await prisma.startup.findMany({
      orderBy: { totalInvestmentReceived: "desc" },
    });

    // Compute Algorithmic Recommendations
    const recommendations: Record<string, { startupId: string; startupName: string; metric: string }> = {};

    if (startups.length > 0) {
      // 1. CHAMPION: highest total investment
      recommendations["CHAMPION"] = {
        startupId: startups[0].id,
        startupName: startups[0].name,
        metric: `${formatINR(startups[0].totalInvestmentReceived)} Valuation`,
      };

      // 2. MOST_FUNDED: highest total investment
      recommendations["MOST_FUNDED"] = {
        startupId: startups[0].id,
        startupName: startups[0].name,
        metric: `${formatINR(startups[0].totalInvestmentReceived)} Raised`,
      };

      // 3. HIGHEST_FII: highest fiiInvestment
      const byFii = [...startups].sort((a, b) => b.fiiInvestment - a.fiiInvestment);
      recommendations["HIGHEST_FII"] = {
        startupId: byFii[0].id,
        startupName: byFii[0].name,
        metric: `${formatINR(byFii[0].fiiInvestment)} Institutional Cheques`,
      };

      // 4. RETAIL_CHOICE: highest retailInvestment
      const byRetail = [...startups].sort((a, b) => b.retailInvestment - a.retailInvestment);
      recommendations["RETAIL_CHOICE"] = {
        startupId: byRetail[0].id,
        startupName: byRetail[0].name,
        metric: `${formatINR(byRetail[0].retailInvestment)} Audience Capital`,
      };

      // 5. MOST_OVERSUBSCRIBED: highest ratio
      const byRatio = [...startups].sort(
        (a, b) =>
          b.totalInvestmentReceived / (b.fundingAsk || 1) -
          a.totalInvestmentReceived / (a.fundingAsk || 1)
      );
      const topRatio = byRatio[0].totalInvestmentReceived / (byRatio[0].fundingAsk || 1);
      recommendations["MOST_OVERSUBSCRIBED"] = {
        startupId: byRatio[0].id,
        startupName: byRatio[0].name,
        metric: `${topRatio.toFixed(2)}x Over-Subscribed`,
      };
    }

    return NextResponse.json({
      awards,
      startups,
      recommendations,
    });
  } catch (error) {
    console.error("Awards API error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { awardKey, startupId, confirmedByAdmin, metric, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    if (!awardKey || !startupId) {
      return NextResponse.json(
        { success: false, message: "awardKey and startupId are required" },
        { status: 400 }
      );
    }

    const startup = await prisma.startup.findUnique({ where: { id: startupId } });
    if (!startup) {
      return NextResponse.json({ success: false, message: "Startup not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const award = await tx.finalAward.update({
        where: { awardKey },
        data: {
          startupId: startup.id,
          startupName: startup.name,
          metric: metric || `${formatINR(startup.totalInvestmentReceived)} Raised`,
          confirmedByAdmin: confirmedByAdmin ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: "CONFIRM_FINAL_AWARD",
          targetType: "AWARD",
          targetId: award.id,
          previousValue: null,
          newValue: JSON.stringify(award),
          reason: `Admin confirmed award ${award.awardName} for ${startup.name}`,
        },
      });

      if (confirmedByAdmin) {
        await tx.activityFeed.create({
          data: {
            type: "ADMIN_ACTION",
            message: `🏆 AWARD CERTIFIED: ${startup.name} officially awarded '${award.awardName}'!`,
            startupName: startup.name,
            isPublic: true,
          },
        });
      }

      return award;
    });

    return NextResponse.json({
      success: true,
      award: updated,
      message: "Award updated successfully",
    });
  } catch (error) {
    console.error("Update award error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
