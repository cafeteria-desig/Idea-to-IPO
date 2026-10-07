import { PrismaClient } from "@prisma/client";
import { executeOrder, getOrderBook, seedMarketLiquidityForStartup } from "../src/lib/trading/engine";
import { seedDatabase } from "../prisma/seed";

const prisma = new PrismaClient();

async function testPricingDynamics() {
  console.log("⚡ Resetting database to clean baseline...");
  await seedDatabase();

  console.log("\n================================================================================");
  console.log("            VERIFYING REALISTIC STOCK MARKET PRICING DYNAMICS                  ");
  console.log("================================================================================\n");

  const startup = await prisma.startup.findUniqueOrThrow({ where: { id: "startup-finflow" } });
  const retailUser = await prisma.user.findUniqueOrThrow({ where: { id: "user-retail-1" } });
  const fiiUser = await prisma.user.findUniqueOrThrow({ where: { id: "user-fii-1" } });

  console.log(`[Baseline] ${startup.name} initialPrice: ₹${startup.currentPrice}`);

  // Step 1: Audience buys 50 shares
  console.log("\n--- STEP 1: Audience buys 50 shares ---");
  const buyRes1 = await executeOrder({
    userId: retailUser.id,
    startupId: startup.id,
    side: "BUY",
    type: "MARKET",
    quantity: 50,
  });

  const sAfterBuy1 = await prisma.startup.findUniqueOrThrow({ where: { id: startup.id } });
  console.log(`Audience buy filled: ${buyRes1.filledQuantity} shares @ avg ₹${buyRes1.averageExecutionPrice.toFixed(2)}`);
  console.log(`New currentPrice: ₹${sAfterBuy1.currentPrice} (Change: +₹${(sAfterBuy1.currentPrice - 100).toFixed(2)})`);

  if (sAfterBuy1.currentPrice <= 100) {
    throw new Error(`FAIL: Audience buy did not increase stock price! Price is ₹${sAfterBuy1.currentPrice}`);
  }
  console.log("✅ PASS: Audience buy successfully increased stock price!");

  // Step 2: FII buys 2,000 shares
  console.log("\n--- STEP 2: FII buys 2,000 shares (institutional block) ---");
  const fiiBuyRes = await executeOrder({
    userId: fiiUser.id,
    startupId: startup.id,
    side: "BUY",
    type: "MARKET",
    quantity: 2000,
  });

  const sAfterFii = await prisma.startup.findUniqueOrThrow({ where: { id: startup.id } });
  console.log(`FII buy filled: ${fiiBuyRes.filledQuantity} shares @ avg ₹${fiiBuyRes.averageExecutionPrice.toFixed(2)}`);
  console.log(`New currentPrice after FII: ₹${sAfterFii.currentPrice} (Total gain: +₹${(sAfterFii.currentPrice - 100).toFixed(2)})`);

  if (sAfterFii.currentPrice <= sAfterBuy1.currentPrice) {
    throw new Error(`FAIL: FII buy did not increase stock price further!`);
  }
  console.log("✅ PASS: FII buy increased stock price proportionally!");

  // Check order book bids after FII buy
  const obAfterFii = await getOrderBook(startup.id);
  console.log(`Order book best bid: ₹${obAfterFii.bestBid}, best ask: ₹${obAfterFii.bestAsk}, spread: ₹${obAfterFii.spread}`);

  if (!obAfterFii.bestBid || obAfterFii.bestBid < sAfterFii.currentPrice * 0.95) {
    throw new Error(`FAIL: Order book bids were not re-centered! Best bid is too low: ₹${obAfterFii.bestBid}`);
  }
  console.log("✅ PASS: Order book bids successfully re-centered upward to support the new price!");

  // Step 3: Audience sells 50 shares (Sensitive downside discovery)
  console.log("\n--- STEP 3: Audience sells 50 shares (Sensitive downside discovery) ---");
  const sellRes = await executeOrder({
    userId: retailUser.id,
    startupId: startup.id,
    side: "SELL",
    type: "MARKET",
    quantity: 50,
  });

  const sAfterSell = await prisma.startup.findUniqueOrThrow({ where: { id: startup.id } });
  const priceDrop = Number((sAfterFii.currentPrice - sAfterSell.currentPrice).toFixed(2));
  const dropPct = Number(((priceDrop / sAfterFii.currentPrice) * 100).toFixed(2));

  console.log(`Audience sold 50 shares @ avg ₹${sellRes.averageExecutionPrice.toFixed(2)}`);
  console.log(`New currentPrice: ₹${sAfterSell.currentPrice} (Drop: -₹${priceDrop} / -${dropPct}%)`);

  if (sAfterSell.currentPrice >= sAfterFii.currentPrice) {
    throw new Error(`FAIL: Stock price did not decrease upon selling!`);
  }
  console.log(`✅ PASS: Stock price is sensitive: dropped by ${dropPct}% (-₹${priceDrop}) immediately on sale!`);

  // Step 4: Multi-startup test - GreenGo
  console.log("\n--- STEP 4: Secondary startup trading (GreenGo) ---");
  await prisma.startup.update({
    where: { id: "startup-greengo" },
    data: { ipoStatus: "IPO_OPEN" },
  });
  await seedMarketLiquidityForStartup("startup-greengo");

  const greenGoBuy = await executeOrder({
    userId: retailUser.id,
    startupId: "startup-greengo",
    side: "BUY",
    type: "MARKET",
    quantity: 100,
  });

  const greenGoAfter = await prisma.startup.findUniqueOrThrow({ where: { id: "startup-greengo" } });
  console.log(`GreenGo bought 100 shares. New Price: ₹${greenGoAfter.currentPrice}`);
  if (greenGoAfter.currentPrice <= 100) {
    throw new Error(`FAIL: GreenGo trading failed to discover price!`);
  }
  console.log("✅ PASS: GreenGo order book active and responsive!");

  // Step 5: Test "As High As Possible" (Massive accumulation surge)
  console.log("\n--- STEP 5: Testing 'As High As Possible' (Consecutive heavy buys) ---");
  // Give FII ample capital
  await prisma.user.update({
    where: { id: fiiUser.id },
    data: { currentBalance: 500000000 },
  });

  const highBuyRes = await executeOrder({
    userId: fiiUser.id,
    startupId: startup.id,
    side: "BUY",
    type: "MARKET",
    quantity: 5000,
  });

  const sAfterMoon = await prisma.startup.findUniqueOrThrow({ where: { id: startup.id } });
  console.log(`Surge buy 5,000 shares filled. Skyrocketed currentPrice to: ₹${sAfterMoon.currentPrice} (Day High: ₹${sAfterMoon.dayHigh})`);
  if (sAfterMoon.currentPrice <= sAfterSell.currentPrice * 2) {
    throw new Error(`FAIL: Price did not surge high enough on 5,000 share buy!`);
  }
  console.log(`✅ PASS: Price surged to ₹${sAfterMoon.currentPrice} — proven boundless upside!`);

  // Step 6: Test "As Low As Possible" (Dumping down to penny stock territory)
  console.log("\n--- STEP 6: Testing 'As Low As Possible' (Heavy dumping down to penny levels) ---");
  // Ensure retail user has enough shares to sell
  await prisma.holding.upsert({
    where: { userId_startupId: { userId: retailUser.id, startupId: startup.id } },
    create: {
      userId: retailUser.id,
      startupId: startup.id,
      quantity: 5000,
      averageBuyPrice: sAfterMoon.currentPrice,
      totalInvested: 5000 * sAfterMoon.currentPrice,
    },
    update: {
      quantity: { increment: 5000 },
    },
  });

  const dumpRes = await executeOrder({
    userId: retailUser.id,
    startupId: startup.id,
    side: "SELL",
    type: "MARKET",
    quantity: 3500,
  });

  const sAfterPlunge = await prisma.startup.findUniqueOrThrow({ where: { id: startup.id } });
  console.log(`Plunge sell 3,500 shares filled. Crashed currentPrice to: ₹${sAfterPlunge.currentPrice} (Day Low: ₹${sAfterPlunge.dayLow})`);
  if (sAfterPlunge.currentPrice >= sAfterMoon.currentPrice * 0.1) {
    throw new Error(`FAIL: Price did not plunge deep enough on 3,500 share dump! Price is ₹${sAfterPlunge.currentPrice}`);
  }
  console.log(`✅ PASS: Price plummeted from ₹${sAfterMoon.currentPrice} down to ₹${sAfterPlunge.currentPrice} — proven boundless downside!`);

  // Step 7: FII Cheque via /api/investments
  console.log("\n--- STEP 7: FII Institutional Cheque via /api/investments (₹25 Lakhs) ---");
  const { POST } = await import("../src/app/api/investments/route");
  const { NextRequest } = await import("next/server");

  const prevFinflow = await prisma.startup.findUniqueOrThrow({ where: { id: "startup-finflow" } });
  const invReq = new NextRequest("http://localhost:3000/api/investments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: fiiUser.id,
      startupId: "startup-finflow",
      amount: 2500000, // ₹25L
    }),
  });

  const invRes = await POST(invReq);
  const invData = await invRes.json();
  const finflowAfterCheque = await prisma.startup.findUniqueOrThrow({ where: { id: "startup-finflow" } });

  console.log(`FII Cheque result: ${invData.success}, Transaction: ${invData.transactionId}`);
  console.log(`FinFlow price after ₹25L institutional cheque: ₹${finflowAfterCheque.currentPrice} (Was: ₹${prevFinflow.currentPrice})`);
  console.log(`Total investment received: ₹${finflowAfterCheque.totalInvestmentReceived}, FII: ₹${finflowAfterCheque.fiiInvestment}`);

  if (finflowAfterCheque.currentPrice <= prevFinflow.currentPrice) {
    throw new Error("FAIL: Institutional cheque did not appreciate stock price!");
  }
  console.log("✅ PASS: Institutional cheque successfully boosted stock valuation and price!");

  console.log("\n================================================================================");
  console.log("🏆 ALL DYNAMIC PRICING TESTS PASSED PERFECTLY!");
  console.log("================================================================================\n");

  await prisma.$disconnect();
}

testPricingDynamics().catch(async (e) => {
  console.error("Test failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
