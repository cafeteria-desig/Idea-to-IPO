import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser, sanitizeUser } from "@/lib/auth";
import { seedMarketLiquidityForStartup } from "@/lib/trading/engine";
import { invalidateCache } from "@/lib/cache";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const admin = await getAdminUser(req);
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
          reason: `Deleted pitch #${startup!.pitchOrder} ${startup!.name} from the exchange.`,
        },
      });
    });

    invalidateCache();

    return NextResponse.json({
      success: true,
      message: `Team "${startup.name}" deleted from exchange.`,
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
    const adminId = body.adminId || req.nextUrl.searchParams.get("adminId") || req.headers.get("x-user-id");
    let admin = await getAdminUser(req);
    if (!admin && adminId) {
      const u = await prisma.user.findUnique({ where: { id: adminId } });
      if (u && u.role === "ADMIN" && u.status === "ACTIVE") {
        admin = sanitizeUser(u);
      }
    }
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
      totalShares,
      pitchOrder,
      problem,
      solution,
      businessModel,
      targetMarket,
      ipoStatus,
      token,
      founderName,
      logoUrl,
      pitchDeckUrl,
      teamMembers,
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
    if (fundingAsk !== undefined && !isNaN(Number(fundingAsk))) updateData.fundingAsk = Number(fundingAsk);
    if (equityOffered !== undefined && !isNaN(Number(equityOffered))) updateData.equityOffered = Number(equityOffered);
    if (pitchOrder !== undefined && !isNaN(Number(pitchOrder))) updateData.pitchOrder = Number(pitchOrder);
    if (ipoStatus) updateData.ipoStatus = ipoStatus;

    if (token && /^\d{6}$/.test(String(token).trim())) {
      const cleanToken = String(token).trim();
      updateData.token = cleanToken;
      await prisma.user.updateMany({
        where: { startupId: startup.id, role: "STARTUP" },
        data: { token: cleanToken, password: cleanToken },
      });
    }

    if (totalShares !== undefined && Number(totalShares) > 0) {
      updateData.totalShares = Math.floor(Number(totalShares));
    }

    const newPrice = Number(shareValue || currentPrice);
    if (newPrice && !isNaN(newPrice) && newPrice > 0) {
      updateData.currentPrice = newPrice;
    }

    if (valuation !== undefined && Number(valuation) > 0) {
      updateData.initialValuation = Number(valuation);
    }

    if (logoUrl !== undefined) {
      updateData.logoUrl = logoUrl ? String(logoUrl).trim() : null;
    }
    if (pitchDeckUrl !== undefined) {
      updateData.pitchDeckUrl = pitchDeckUrl ? String(pitchDeckUrl).trim() : null;
    }

    if (typeof teamMembers === "string" && teamMembers.trim()) {
      updateData.teamMembers = teamMembers.trim();
    } else if (founderName) {
      const trimmedFounder = String(founderName).trim();
      let members: any[] = [];
      try {
        members = JSON.parse(startup.teamMembers || "[]");
      } catch {
        members = [];
      }
      if (Array.isArray(members) && members.length > 0) {
        members[0].name = trimmedFounder;
      } else {
        members = [
          {
            name: trimmedFounder,
            role: "Founder / Lead Presenter",
            avatar: "",
            bio: `Pioneering ${updateData.name || startup.name}`,
          },
        ];
      }
      updateData.teamMembers = JSON.stringify(members);
      await prisma.user.updateMany({
        where: { startupId: startup.id, role: "STARTUP" },
        data: { name: `${trimmedFounder} (${updateData.name || startup.name})` },
      });
    } else if (updateData.name && updateData.name !== startup.name) {
      await prisma.user.updateMany({
        where: { startupId: startup.id, role: "STARTUP" },
        data: { name: `${updateData.name} Founder` },
      });
    }

    const updated = await prisma.startup.update({
      where: { id: startup.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminName: admin.name,
        action: "UPDATE_STARTUP",
        targetType: "STARTUP",
        targetId: updated.id,
        reason: `Updated pitch #${updated.pitchOrder} ${updated.name} (${updated.industry}) | Ask: ₹${updated.fundingAsk} | LTP: ₹${updated.currentPrice} | Status: ${updated.ipoStatus}`,
      },
    }).catch(() => {});

    invalidateCache();

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
