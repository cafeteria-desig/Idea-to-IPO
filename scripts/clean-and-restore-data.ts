import { PrismaClient } from "@prisma/client";
import audienceTokens from "../src/data/audience-tokens.json";
import { invalidateCache } from "../src/lib/cache";

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl },
  },
});

async function main() {
  console.log("==================================================================");
  console.log("   CLEANING SITE DATA & RESTORING AUDIENCE INVESTOR FUNDINGS       ");
  console.log("==================================================================");

  // 1. Clear all transactional, market, and trading records
  console.log("[1/5] Clearing all trading activity, orders, holdings, and investments...");
  const delActivity = await prisma.activityFeed.deleteMany({});
  console.log(` - Cleared ActivityFeed: ${delActivity.count} rows`);

  const delAwards = await prisma.finalAward.deleteMany({});
  console.log(` - Cleared FinalAwards: ${delAwards.count} rows`);

  const delWatchlist = await prisma.watchlist.deleteMany({});
  console.log(` - Cleared Watchlists: ${delWatchlist.count} rows`);

  const delAdjustments = await prisma.capitalAdjustment.deleteMany({});
  console.log(` - Cleared CapitalAdjustments: ${delAdjustments.count} rows`);

  const delPriceHist = await prisma.priceHistory.deleteMany({});
  console.log(` - Cleared PriceHistory: ${delPriceHist.count} rows`);

  const delTrades = await prisma.trade.deleteMany({});
  console.log(` - Cleared Trades: ${delTrades.count} rows`);

  const delOrders = await prisma.order.deleteMany({});
  console.log(` - Cleared Orders: ${delOrders.count} rows`);

  const delHoldings = await prisma.holding.deleteMany({});
  console.log(` - Cleared Holdings: ${delHoldings.count} rows`);

  const delInvestments = await prisma.investment.deleteMany({});
  console.log(` - Cleared Investments: ${delInvestments.count} rows`);

  // 2. Remove all Companies (Startups)
  console.log("[2/5] Removing all Companies / Startups from site data...");
  const delStartups = await prisma.startup.deleteMany({});
  console.log(` - Removed Startups: ${delStartups.count} companies`);

  // 3. Remove Startup founders, FIIs, and test Retail accounts
  console.log("[3/5] Removing all Company Founder accounts, FII accounts, and test Retail users...");
  const delFounders = await prisma.user.deleteMany({
    where: { role: "STARTUP" },
  });
  console.log(` - Removed Founder accounts: ${delFounders.count}`);

  const delFII = await prisma.user.deleteMany({
    where: { role: "FII" },
  });
  console.log(` - Removed FII accounts: ${delFII.count}`);

  const delTestRetail = await prisma.user.deleteMany({
    where: {
      role: "RETAIL",
      NOT: { email: { startsWith: "audience" } },
    },
  });
  console.log(` - Removed test Retail accounts: ${delTestRetail.count}`);

  // 4. Ensure Admin account exists with full liquidity
  console.log("[4/5] Restoring Admin Control Room account...");
  await prisma.user.upsert({
    where: { email: "admin@ideaipo.com" },
    update: {
      name: "Event Director",
      password: "Bhavishy@2007",
      token: "999999",
      role: "ADMIN",
      status: "ACTIVE",
      startingCapital: 500000000,
      currentBalance: 500000000,
      totalInvested: 0,
      isOnline: true,
      activeSessionId: null,
      sessionCreatedAt: null,
    },
    create: {
      id: "user-admin",
      name: "Event Director",
      email: "admin@ideaipo.com",
      password: "Bhavishy@2007",
      token: "999999",
      role: "ADMIN",
      status: "ACTIVE",
      startingCapital: 500000000,
      currentBalance: 500000000,
      totalInvested: 0,
      isOnline: true,
    },
  });

  // 5. Restore all Audience Members and reset their fundings to full ₹1,00,000
  console.log("[5/5] Restoring all 153 Audience Members with full ₹1,00,000 funding...");
  const audienceList = audienceTokens as Array<{
    sNo: number;
    name: string;
    token: string;
    role: string;
    email: string;
    startingCapital: number;
    currentBalance: number;
  }>;

  let restoredAudienceCount = 0;
  for (const aud of audienceList) {
    const padNum = String(aud.sNo).padStart(3, "0");
    const email = aud.email.toLowerCase().trim();
    const token = String(aud.token).trim();

    await prisma.user.upsert({
      where: { email },
      update: {
        name: aud.name,
        password: token,
        token: token,
        role: "RETAIL",
        status: "ACTIVE",
        startingCapital: 100000,
        currentBalance: 100000,
        totalInvested: 0,
        isOnline: false,
        activeSessionId: null,
        sessionCreatedAt: null,
        startupId: null,
      },
      create: {
        id: `user-audience-${padNum}`,
        name: aud.name,
        email,
        password: token,
        token: token,
        role: "RETAIL",
        status: "ACTIVE",
        startingCapital: 100000,
        currentBalance: 100000,
        totalInvested: 0,
        isOnline: false,
      },
    });
    restoredAudienceCount++;
  }
  console.log(` - Restored funding for ${restoredAudienceCount} audience members!`);

  // Reset global market state
  await prisma.marketState.upsert({
    where: { id: "global" },
    update: {
      isMarketActive: true,
      activeStartupId: null,
      bannerMessage: "Welcome to IDEA TO IPO — Live Auditorium Pitch & Capital Exchange",
    },
    create: {
      id: "global",
      isMarketActive: true,
      activeStartupId: null,
      bannerMessage: "Welcome to IDEA TO IPO — Live Auditorium Pitch & Capital Exchange",
    },
  });

  invalidateCache();

  // Verification counts
  const totalUsers = await prisma.user.count();
  const totalAudience = await prisma.user.count({ where: { role: "RETAIL" } });
  const totalAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  const totalStartupsAfter = await prisma.startup.count();

  console.log("==================================================================");
  console.log("🎉 SITE CLEANUP & AUDIENCE FUNDING RESTORATION COMPLETE!");
  console.log(` - Remaining Startups / Companies: ${totalStartupsAfter} (All cleared)`);
  console.log(` - Total Audience Members: ${totalAudience} (All restored to ₹1,00,000)`);
  console.log(` - Admin Accounts: ${totalAdmins}`);
  console.log(` - Total Users: ${totalUsers}`);
  console.log("==================================================================");
}

main()
  .catch((e) => {
    console.error("Clean & restore error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
