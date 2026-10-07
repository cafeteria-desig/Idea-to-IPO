import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { formatINR } from "@/lib/formatters";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { action = "CANCEL", reason, adminId } = body;

    const admin = await getAdminUser(req, adminId);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const investment = await prisma.investment.findUnique({
      where: { id },
      include: { startup: true, investor: true },
    });

    if (!investment) {
      return NextResponse.json({ success: false, message: "Investment not found" }, { status: 404 });
    }

    if (action === "CANCEL" || action === "REVERSE") {
      if (investment.status !== "VALID") {
        return NextResponse.json(
          { success: false, message: `Cannot cancel transaction with status ${investment.status}` },
          { status: 400 }
        );
      }

      const newStatus = action === "REVERSE" ? "REVERSED" : "CANCELLED";

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update investment status
        const updatedInv = await tx.investment.update({
          where: { id: investment.id },
          data: {
            status: newStatus,
            note: reason || "Cancelled by admin",
          },
        });

        // 2. Restore user balance
        await tx.user.update({
          where: { id: investment.investorId },
          data: {
            currentBalance: { increment: investment.amount },
            totalInvested: { decrement: investment.amount },
          },
        });

        // 3. Decrement startup totals
        await tx.startup.update({
          where: { id: investment.startupId },
          data: {
            totalInvestmentReceived: { decrement: investment.amount },
            ...(investment.investorType === "RETAIL"
              ? { retailInvestment: { decrement: investment.amount } }
              : {}),
            ...(investment.investorType === "FII"
              ? { fiiInvestment: { decrement: investment.amount } }
              : {}),
            investorCount: { decrement: 1 },
          },
        });

        // 3b. Rebalance Holding if exists
        const currentHolding = await tx.holding.findUnique({
          where: {
            userId_startupId: {
              userId: investment.investorId,
              startupId: investment.startupId,
            },
          },
        });
        if (currentHolding) {
          const defaultPrice = investment.startup.currentPrice || 100;
          const sharesToDeduct = Math.max(1, Math.round(investment.amount / defaultPrice));
          const remQty = Math.max(0, currentHolding.quantity - sharesToDeduct);
          const remInvested = Math.max(0, currentHolding.totalInvested - investment.amount);
          const remAvg = remQty > 0 ? remInvested / remQty : 0;
          await tx.holding.update({
            where: { id: currentHolding.id },
            data: {
              quantity: remQty,
              totalInvested: remInvested,
              averageBuyPrice: Number(remAvg.toFixed(2)),
            },
          });
        }

        // 4. Create Audit Log
        await tx.auditLog.create({
          data: {
            adminId: admin.id,
            adminName: admin.name,
            action: `CANCEL_TRANSACTION_${newStatus}`,
            targetType: "INVESTMENT",
            targetId: investment.id,
            previousValue: JSON.stringify({ status: "VALID", amount: investment.amount }),
            newValue: JSON.stringify({ status: newStatus }),
            reason: reason || "Admin transaction reversal",
          },
        });

        // 5. Activity Feed announcement
        await tx.activityFeed.create({
          data: {
            type: "ADMIN_ACTION",
            message: `Admin cancelled investment ${investment.id} of ${formatINR(investment.amount)} in ${investment.startup.name}`,
            startupName: investment.startup.name,
            investorName: investment.investorName,
            amount: investment.amount,
            isPublic: true,
          },
        });

        return updatedInv;
      });

      return NextResponse.json({
        success: true,
        investment: result,
        message: `Transaction ${id} successfully marked as ${newStatus}`,
      });
    } else if (action === "RESTORE") {
      if (investment.status === "VALID") {
        return NextResponse.json({ success: false, message: "Transaction is already valid" }, { status: 400 });
      }

      // Check if user has sufficient funds to re-commit
      const user = await prisma.user.findUnique({ where: { id: investment.investorId } });
      if (!user || user.currentBalance < investment.amount) {
        return NextResponse.json(
          { success: false, message: "Investor has insufficient liquid balance to restore transaction" },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update investment status
        const updatedInv = await tx.investment.update({
          where: { id: investment.id },
          data: {
            status: "VALID",
            note: reason || "Restored by admin",
          },
        });

        // 2. Re-deduct user balance
        await tx.user.update({
          where: { id: investment.investorId },
          data: {
            currentBalance: { decrement: investment.amount },
            totalInvested: { increment: investment.amount },
          },
        });

        // 3. Increment startup totals
        await tx.startup.update({
          where: { id: investment.startupId },
          data: {
            totalInvestmentReceived: { increment: investment.amount },
            ...(investment.investorType === "RETAIL"
              ? { retailInvestment: { increment: investment.amount } }
              : {}),
            ...(investment.investorType === "FII"
              ? { fiiInvestment: { increment: investment.amount } }
              : {}),
            investorCount: { increment: 1 },
          },
        });

        // 4. Audit Log
        await tx.auditLog.create({
          data: {
            adminId: admin.id,
            adminName: admin.name,
            action: "RESTORE_TRANSACTION",
            targetType: "INVESTMENT",
            targetId: investment.id,
            previousValue: JSON.stringify({ status: investment.status }),
            newValue: JSON.stringify({ status: "VALID" }),
            reason: reason || "Admin restored transaction",
          },
        });

        return updatedInv;
      });

      return NextResponse.json({
        success: true,
        investment: result,
        message: `Transaction ${id} successfully restored to VALID`,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Cancel/Restore transaction error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
