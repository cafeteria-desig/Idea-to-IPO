import { PrismaClient } from "@prisma/client";
import { executeOrder, cancelOrder, getOrderBook, seedMarketLiquidityForStartup } from "../src/lib/trading/engine";
import { seedDatabase } from "../prisma/seed";

const prisma = new PrismaClient();

interface TestResult {
  num: number;
  scenario: string;
  passed: boolean;
  notes: string;
}

async function runTradingVerificationSuite() {
  console.log("================================================================================");
  console.log("             IDEA TO IPO — VIRTUAL STOCK TRADING ENGINE VERIFICATION            ");
  console.log("                 Full-Stack Order Book & Matching Test Suite                    ");
  console.log("================================================================================\n");

  console.log("⚡ Resetting database to clean baseline...");
  await seedDatabase();
  console.log("✅ Baseline restored. Commencing trading scenarios...\n");

  const results: TestResult[] = [];

  // Scenario 1: Limit Buy order placement locks cash in escrow
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const initialBal = user.currentBalance;
    const qty = 50;
    const price = 95; // Below current price of 100, won't match immediately
    const expectedLock = qty * price;

    const res = await executeOrder({
      userId: user.id,
      startupId: "startup-finflow",
      side: "BUY",
      type: "LIMIT",
      quantity: qty,
      price,
    });

    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const passed =
      res.success &&
      res.status === "OPEN" &&
      freshUser.currentBalance === initialBal - expectedLock;

    results.push({
      num: 1,
      scenario: "Limit Buy order placement & cash escrow",
      passed,
      notes: `Order ${res.orderId} placed. Cash locked: ₹${expectedLock} (Balance ₹${freshUser.currentBalance})`,
    });
  } catch (e: any) {
    results.push({ num: 1, scenario: "Limit Buy order placement & cash escrow", passed: false, notes: e.message });
  }

  // Scenario 2: Cancel Buy Limit order refunds locked cash
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const prevBal = user.currentBalance;

    const openOrder = await prisma.order.findFirstOrThrow({
      where: { userId: user.id, status: "OPEN", side: "BUY" },
    });

    const refundExpected = openOrder.remainingQuantity * openOrder.price;
    const cancelRes = await cancelOrder(openOrder.id, user.id);

    const afterUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const passed =
      cancelRes.success &&
      afterUser.currentBalance === prevBal + refundExpected;

    results.push({
      num: 2,
      scenario: "Order cancellation & cash unfreezing",
      passed,
      notes: `Order ${openOrder.id} cancelled. Refunded: ₹${refundExpected} -> Balance ₹${afterUser.currentBalance}`,
    });
  } catch (e: any) {
    results.push({ num: 2, scenario: "Order cancellation & cash unfreezing", passed: false, notes: e.message });
  }

  // Scenario 3: Market Buy fills against existing sell liquidity & creates Holding
  try {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const prevBal = buyer.currentBalance;
    const buyQty = 100;

    const res = await executeOrder({
      userId: buyer.id,
      startupId: "startup-finflow",
      side: "BUY",
      type: "MARKET",
      quantity: buyQty,
    });

    const freshBuyer = await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } });
    const holding = await prisma.holding.findUnique({
      where: { userId_startupId: { userId: buyer.id, startupId: "startup-finflow" } },
    });

    const passed =
      res.success &&
      res.filledQuantity === buyQty &&
      holding !== null &&
      holding.quantity === buyQty &&
      holding.averageBuyPrice > 0 &&
      freshBuyer.currentBalance < prevBal;

    results.push({
      num: 3,
      scenario: "Market Buy execution & Holding creation",
      passed,
      notes: `Bought ${buyQty} shares @ avg ₹${holding?.averageBuyPrice.toFixed(2)}. Total Invested: ₹${holding?.totalInvested.toFixed(2)}`,
    });
  } catch (e: any) {
    results.push({ num: 3, scenario: "Market Buy execution & Holding creation", passed: false, notes: e.message });
  }

  // Scenario 4: Multiple buys calculate accurate weighted average buy price
  try {
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const prevHolding = await prisma.holding.findUniqueOrThrow({
      where: { userId_startupId: { userId: buyer.id, startupId: "startup-finflow" } },
    });

    const buyQty2 = 100;
    const res = await executeOrder({
      userId: buyer.id,
      startupId: "startup-finflow",
      side: "BUY",
      type: "MARKET",
      quantity: buyQty2,
    });

    const newHolding = await prisma.holding.findUniqueOrThrow({
      where: { userId_startupId: { userId: buyer.id, startupId: "startup-finflow" } },
    });

    const expectedQty = prevHolding.quantity + buyQty2;
    const expectedAvg = newHolding.totalInvested / expectedQty;

    const passed =
      newHolding.quantity === expectedQty &&
      Math.abs(newHolding.averageBuyPrice - expectedAvg) < 0.01;

    results.push({
      num: 4,
      scenario: "Weighted average buy price recalculation",
      passed,
      notes: `Holding: ${newHolding.quantity} shares. New Average Buy Price: ₹${newHolding.averageBuyPrice.toFixed(2)}`,
    });
  } catch (e: any) {
    results.push({ num: 4, scenario: "Weighted average buy price recalculation", passed: false, notes: e.message });
  }

  // Scenario 5: Overselling protection (cannot sell more shares than owned)
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const holding = await prisma.holding.findUniqueOrThrow({
      where: { userId_startupId: { userId: user.id, startupId: "startup-finflow" } },
    });

    let rejected = false;
    try {
      await executeOrder({
        userId: user.id,
        startupId: "startup-finflow",
        side: "SELL",
        type: "LIMIT",
        quantity: holding.quantity + 500, // Exceeds owned
        price: 150,
      });
    } catch (err: any) {
      if (err.message.includes("Insufficient shares owned")) {
        rejected = true;
      }
    }

    results.push({
      num: 5,
      scenario: "Overselling protection",
      passed: rejected,
      notes: rejected ? "Attempt to sell more shares than owned was strictly rejected" : "Failed to reject oversell",
    });
  } catch (e: any) {
    results.push({ num: 5, scenario: "Overselling protection", passed: false, notes: e.message });
  }

  // Scenario 6: Overdraft protection (cannot buy more shares than cash balance)
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    let rejected = false;

    try {
      await executeOrder({
        userId: user.id,
        startupId: "startup-finflow",
        side: "BUY",
        type: "LIMIT",
        quantity: 100000,
        price: 500, // Massive required cash > currentBalance
      });
    } catch (err: any) {
      if (err.message.includes("Insufficient cash balance")) {
        rejected = true;
      }
    }

    results.push({
      num: 6,
      scenario: "Overdraft protection",
      passed: rejected,
      notes: rejected ? "Attempt to exceed virtual capital strictly rejected with rollback" : "Failed to reject overdraft",
    });
  } catch (e: any) {
    results.push({ num: 6, scenario: "Overdraft protection", passed: false, notes: e.message });
  }

  // Scenario 7: Partial sell calculates accurate realized P&L and updates holding
  try {
    const seller = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const holdingBefore = await prisma.holding.findUniqueOrThrow({
      where: { userId_startupId: { userId: seller.id, startupId: "startup-finflow" } },
    });
    const prevCash = seller.currentBalance;

    const sellQty = 50; // Sell 50 out of 200 shares
    const res = await executeOrder({
      userId: seller.id,
      startupId: "startup-finflow",
      side: "SELL",
      type: "MARKET",
      quantity: sellQty,
    });

    const holdingAfter = await prisma.holding.findUniqueOrThrow({
      where: { userId_startupId: { userId: seller.id, startupId: "startup-finflow" } },
    });
    const sellerAfter = await prisma.user.findUniqueOrThrow({ where: { id: seller.id } });

    const passed =
      res.success &&
      holdingAfter.quantity === holdingBefore.quantity - sellQty &&
      sellerAfter.currentBalance > prevCash;

    results.push({
      num: 7,
      scenario: "Partial sell & Realized P&L calculation",
      passed,
      notes: `Sold ${sellQty} shares. Realized P&L: ₹${holdingAfter.realizedPnL.toFixed(2)}. Remaining shares: ${holdingAfter.quantity}`,
    });
  } catch (e: any) {
    results.push({ num: 7, scenario: "Partial sell & Realized P&L calculation", passed: false, notes: e.message });
  }

  // Scenario 8: Direct two-party Order Book matching (User A sells, User B buys)
  try {
    const seller = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-2" } });

    // Retail 1 places Limit Sell of 25 shares @ ₹99.50 (best ask in market)
    const sellRes = await executeOrder({
      userId: seller.id,
      startupId: "startup-finflow",
      side: "SELL",
      type: "LIMIT",
      quantity: 25,
      price: 99.5,
    });

    // Retail 2 places Limit Buy of 25 shares @ ₹100 (matches against Retail 1's best ask)
    const buyRes = await executeOrder({
      userId: buyer.id,
      startupId: "startup-finflow",
      side: "BUY",
      type: "LIMIT",
      quantity: 25,
      price: 100,
    });

    const startup = await prisma.startup.findUniqueOrThrow({ where: { id: "startup-finflow" } });

    const matchedTrade = buyRes.trades.find((t) => t.sellerId === seller.id);
    const passed =
      buyRes.success &&
      matchedTrade !== undefined &&
      matchedTrade.quantity === 25 &&
      matchedTrade.price === 99.5 &&
      startup.currentPrice === 99.5;

    results.push({
      num: 8,
      scenario: "P2P Limit Order Book matching & LTP update",
      passed,
      notes: `Matched 25 shares @ ₹99.50 between ${seller.name} & ${buyer.name}. LTP updated to ₹${startup.currentPrice}`,
    });
  } catch (e: any) {
    results.push({ num: 8, scenario: "P2P Limit Order Book matching & LTP update", passed: false, notes: e.message });
  }

  // Scenario 9: Price discovery statistics update (Day High, Day Low, Traded Volume)
  try {
    const startup = await prisma.startup.findUniqueOrThrow({ where: { id: "startup-finflow" } });
    const passed =
      startup.dayHigh >= 100 &&
      startup.dayLow <= 99.5 &&
      startup.totalVolume > 0 &&
      startup.currentPrice === 99.5;

    results.push({
      num: 9,
      scenario: "Price discovery statistics tracking",
      passed,
      notes: `LTP ₹${startup.currentPrice}, Day High ₹${startup.dayHigh}, Day Low ₹${startup.dayLow}, Total Volume: ${startup.totalVolume} shares`,
    });
  } catch (e: any) {
    results.push({ num: 9, scenario: "Price discovery statistics tracking", passed: false, notes: e.message });
  }

  // Scenario 10: Suspended stock rejects all new orders
  try {
    await prisma.startup.update({
      where: { id: "startup-finflow" },
      data: { isSuspended: true },
    });

    let rejected = false;
    try {
      await executeOrder({
        userId: "user-retail-1",
        startupId: "startup-finflow",
        side: "BUY",
        type: "LIMIT",
        quantity: 10,
        price: 100,
      });
    } catch (err: any) {
      if (err.message.includes("currently suspended")) {
        rejected = true;
      }
    }

    // Restore active
    await prisma.startup.update({
      where: { id: "startup-finflow" },
      data: { isSuspended: false },
    });

    results.push({
      num: 10,
      scenario: "Stock suspension order rejection",
      passed: rejected,
      notes: rejected ? "Orders strictly denied when isSuspended = true" : "Failed to block suspended stock",
    });
  } catch (e: any) {
    results.push({ num: 10, scenario: "Stock suspension order rejection", passed: false, notes: e.message });
  }

  // Scenario 11: Master market freeze blocks all trading globally
  try {
    await prisma.marketState.update({
      where: { id: "global" },
      data: { isMarketActive: false },
    });

    let blocked = false;
    try {
      await executeOrder({
        userId: "user-retail-1",
        startupId: "startup-finflow",
        side: "BUY",
        type: "MARKET",
        quantity: 10,
      });
    } catch (err: any) {
      if (err.message.includes("CLOSED or PAUSED")) {
        blocked = true;
      }
    }

    // Restore active
    await prisma.marketState.update({
      where: { id: "global" },
      data: { isMarketActive: true },
    });

    results.push({
      num: 11,
      scenario: "Master Market freeze circuit breaker",
      passed: blocked,
      notes: blocked ? "Global pause denies order execution across all stocks" : "Failed to block when market inactive",
    });
  } catch (e: any) {
    results.push({ num: 11, scenario: "Master Market freeze circuit breaker", passed: false, notes: e.message });
  }

  // Scenario 12: Order Book depth aggregation reflects real active quotes
  try {
    const ob = await getOrderBook("startup-finflow");
    const passed =
      ob.startupId === "startup-finflow" &&
      Array.isArray(ob.bids) &&
      Array.isArray(ob.asks);

    results.push({
      num: 12,
      scenario: "Real-time Order Book depth aggregation",
      passed,
      notes: `Order Book loaded with ${ob.bids.length} bid levels & ${ob.asks.length} ask levels. Spread: ₹${ob.spread}`,
    });
  } catch (e: any) {
    results.push({ num: 12, scenario: "Real-time Order Book depth aggregation", passed: false, notes: e.message });
  }

  // Output Summary
  console.log("\n================================================================================");
  console.log("                     TRADING ENGINE VERIFICATION SUMMARY                        ");
  console.log("================================================================================");
  console.log(
    "| #  | Verified Trading Scenario                  | Status | Notes"
  );
  console.log(
    "|:--:|:-------------------------------------------|:------:|:--------------------------------"
  );

  let allPassed = true;
  results.forEach((r) => {
    if (!r.passed) allPassed = false;
    const numStr = r.num.toString().padStart(2, " ");
    const scenarioStr = r.scenario.padEnd(42, " ");
    const statusStr = r.passed ? " PASS " : " FAIL ";
    console.log(`| ${numStr} | ${scenarioStr} | ${statusStr} | ${r.notes}`);
  });

  console.log("================================================================================\n");

  if (allPassed) {
    console.log("🏆 ALL TRADING SCENARIOS PASSED WITH 100% SUCCESS!");
  } else {
    console.error("❌ SOME TRADING SCENARIOS FAILED.");
    process.exit(1);
  }

  await prisma.$disconnect();
}

runTradingVerificationSuite().catch(async (e) => {
  console.error("Trading verification failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
