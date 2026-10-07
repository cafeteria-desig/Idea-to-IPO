import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { seedMarketLiquidityForStartup } from "@/lib/trading/engine";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const adminId = body.adminId || req.nextUrl.searchParams.get("adminId") || req.headers.get("x-user-id");
    const admin = await getAdminUser(req, adminId || undefined);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    let startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup) {
      startup = await prisma.startup.findUnique({ where: { slug: id } });
    }
    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup not found" },
        { status: 404 }
      );
    }

    // 1. Delete all associated records in dependency order
    await prisma.$transaction(async (tx) => {
      await tx.activityFeed.deleteMany({ where: { startupName: startup!.name } });
      await tx.trade.deleteMany({ where: { startupId: startup!.id } });
      await tx.order.deleteMany({ where: { startupId: startup!.id } });
      await tx.holding.deleteMany({ where: { startupId: startup!.id } });
      await tx.investment.deleteMany({ where: { startupId: startup!.id } });
      await tx.priceHistory.deleteMany({ where: { startupId: startup!.id } });
      await tx.finalAward.deleteMany({ where: { startupId: startup!.id } });
      await tx.watchlist.deleteMany({ where: { startupId: startup!.id } });
      await tx.user.updateMany({
        where: { startupId: startup!.id },
        data: { startupId: null },
      });
      await tx.startup.delete({ where: { id: startup!.id } });

      // If activeStartupId in global market state was this startup, set to null or next available
      const ms = await tx.marketState.findUnique({ where: { id: "global" } });
      if (ms?.activeStartupId === startup!.id) {
        const nextStartup = await tx.startup.findFirst({
          orderBy: { pitchOrder: "asc" },
        });
        await tx.marketState.update({
          where: { id: "global" },
          data: { activeStartupId: nextStartup?.id || null },
        });
      }

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          adminName: admin.name,
          action: "DELETE_STARTUP",
          targetType: "STARTUP",
          targetId: startup!.id,
          reason: `Admin deleted startup team "${startup!.name}" (Pitch #${startup!.pitchOrder})`,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({
      success: true,
      message: `Team "${startup.name}" has been permanently removed.`,
    });
  } catch (error: any) {
    console.error("Delete startup error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete startup" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const admin = await getAdminUser(req, body.adminId);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Admin privileges required" },
        { status: 403 }
      );
    }

    let startup = await prisma.startup.findUnique({ where: { id } });
    if (!startup) {
      startup = await prisma.startup.findUnique({ where: { slug: id } });
    }
    if (!startup) {
      return NextResponse.json(
        { success: false, message: "Startup not found" },
        { status: 404 }
      );
    }

    const {
      name,
      idea,
      pitchSummary,
      tagLine,
      industry,
      fundingAsk,
      shareValue,
      currentPrice,
      equityOffered,
      valuation,
      pitchOrder,
      problem,
      solution,
      businessModel,
      targetMarket,
      ipoStatus,
    } = body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (tagLine) updateData.tagLine = tagLine.trim();
    if (industry) updateData.industry = industry.trim();
    if (idea || pitchSummary) {
      updateData.pitchSummary = (pitchSummary || idea).trim();
      if (!problem) updateData.problem = (pitchSummary || idea).trim();
      if (!solution) updateData.solution = (pitchSummary || idea).trim();
    }
    if (problem) updateData.problem = problem.trim();
    if (solution) updateData.solution = solution.trim();
    if (businessModel) updateData.businessModel = businessModel.trim();
    if (targetMarket) updateData.targetMarket = targetMarket.trim();
    if (fundingAsk) updateData.fundingAsk = Number(fundingAsk);
    if (equityOffered) updateData.equityOffered = Number(equityOffered);
    if (pitchOrder) updateData.pitchOrder = Number(pitchOrder);
    if (ipoStatus) updateData.ipoStatus = ipoStatus;

    const newPrice = Number(shareValue || currentPrice);
    if (newPrice && !isNaN(newPrice) && newPrice > 0) {
      updateData.currentPrice = newPrice;
    }

    if (valuation && Number(valuation) > 0) {
      updateData.initialValuation = Number(valuation);
    }

    const updated = await prisma.startup.update({
      where: { id: startup.id },
      data: updateData,
    });

    if (newPrice && newPrice !== startup.currentPrice) {
      try {
        await seedMarketLiquidityForStartup(updated.id);
      } catch (e) {
        // Ignored
      }
    }

    return NextResponse.json({
      success: true,
      message: `Team "${updated.name}" updated successfully.`,
      startup: updated,
    });
  } catch (error: any) {
    console.error("Update startup error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update startup" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
