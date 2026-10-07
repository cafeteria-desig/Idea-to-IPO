import { PrismaClient } from "@prisma/client";
import { seedMarketLiquidityForStartup } from "../src/lib/trading/engine";
import audienceTokens from "../src/data/audience-tokens.json";

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log("🚀 Seeding IDEA TO IPO database baseline...");

  // 1. Clear existing records in reverse dependency order
  await prisma.activityFeed.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.capitalAdjustment.deleteMany();
  await prisma.finalAward.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.priceHistory.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.order.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.user.deleteMany();
  await prisma.startup.deleteMany();
  await prisma.marketState.deleteMany();

  // 2. Seed Global Market State
  await prisma.marketState.create({
    data: {
      id: "global",
      isMarketActive: true,
      activeStartupId: null,
      hideInvestorNamesPublicly: false,
      bannerMessage: "Welcome to IDEA TO IPO — Live Auditorium Pitch & Capital Exchange",
    },
  });

  // 3. Startups: Clean slate (no trial teams)
  const startups: any[] = [];
  for (const startup of startups) {
    await prisma.startup.create({ data: startup });
  }

  // 4. Seed Users (Matching Spec §11 Credentials Table exactly)
  const users = [
    {
      id: "user-admin",
      name: "Event Director",
      email: "admin@ideaipo.com",
      password: "Bhavishy@2007",
      token: null,
      role: "ADMIN",
      status: "ACTIVE",
      startingCapital: 0,
      currentBalance: 0,
      totalInvested: 0,
      isOnline: true,
    },
    {
      id: "user-fii-1",
      name: "Nexus Horizon Capital",
      email: "fii1@ideaipo.com",
      password: "fii",
      token: "837195",
      role: "FII",
      status: "ACTIVE",
      startingCapital: 10000000, // ₹1 Cr
      currentBalance: 10000000,
      totalInvested: 0,
      isOnline: true,
    },
    {
      id: "user-fii-2",
      name: "BluePeak Ventures",
      email: "fii2@ideaipo.com",
      password: "fii",
      token: "394820",
      role: "FII",
      status: "ACTIVE",
      startingCapital: 5000000, // ₹50 Lakhs
      currentBalance: 5000000,
      totalInvested: 0,
      isOnline: false,
    },
    {
      id: "user-fii-3",
      name: "Titan Angel Syndicate",
      email: "fii3@ideaipo.com",
      password: "fii",
      token: "620174",
      role: "FII",
      status: "ACTIVE",
      startingCapital: 7500000, // ₹75 Lakhs
      currentBalance: 7500000,
      totalInvested: 0,
      isOnline: false,
    },
    {
      id: "user-retail-1",
      name: "Rahul Verma",
      email: "retail1@ideaipo.com",
      password: "retail",
      token: "739214",
      role: "RETAIL",
      status: "ACTIVE",
      startingCapital: 500000, // ₹5 Lakhs
      currentBalance: 500000,
      totalInvested: 0,
      isOnline: true,
    },
    {
      id: "user-retail-2",
      name: "Priya Sharma",
      email: "retail2@ideaipo.com",
      password: "retail",
      token: "482051",
      role: "RETAIL",
      status: "ACTIVE",
      startingCapital: 500000, // ₹5 Lakhs
      currentBalance: 500000,
      totalInvested: 0,
      isOnline: false,
    },
    {
      id: "user-retail-3",
      name: "Aditya Kumar",
      email: "retail3@ideaipo.com",
      password: "retail",
      token: "915638",
      role: "RETAIL",
      status: "ACTIVE",
      startingCapital: 500000, // ₹5 Lakhs
      currentBalance: 500000,
      totalInvested: 0,
      isOnline: false,
    },
    {
      id: "user-founder-1",
      name: "Aarav Mehta (FinFlow)",
      email: "founder.finflow@ideaipo.com",
      password: "startup",
      token: "529461",
      role: "STARTUP",
      status: "ACTIVE",
      startingCapital: 0,
      currentBalance: 0,
      totalInvested: 0,
      isOnline: true,
      startupId: "startup-finflow",
    },
  ];

  // Append all 150 Audience accounts from audience-tokens.json
  for (const aud of (audienceTokens as Array<{ sNo: number; name: string; token: string; email: string; startingCapital: number; currentBalance: number }>)) {
    if (aud.email.startsWith("audience")) {
      const padNum = String(aud.sNo).padStart(3, "0");
      users.push({
        id: `user-audience-${padNum}`,
        name: aud.name,
        email: aud.email,
        password: aud.token,
        token: aud.token,
        role: "RETAIL",
        status: "ACTIVE",
        startingCapital: aud.startingCapital,
        currentBalance: aud.currentBalance,
        totalInvested: 0,
        isOnline: false,
      } as any);
    }
  }

  for (const user of users) {
    await prisma.user.create({ data: user });
  }

  // 5. Seed Final Awards
  const awards = [
    {
      awardKey: "CHAMPION",
      awardName: "IPO Grand Champion",
      metric: "Highest Overall Valuation & Market Confidence",
      isPublic: true,
      confirmedByAdmin: false,
    },
    {
      awardKey: "MOST_FUNDED",
      awardName: "Top Gross Capital Raised",
      metric: "Cumulative Gross Inflow Across All Tiers",
      isPublic: true,
      confirmedByAdmin: false,
    },
    {
      awardKey: "HIGHEST_FII",
      awardName: "Institutional Choice Award",
      metric: "Maximum Institutional VC Cheque Volume",
      isPublic: true,
      confirmedByAdmin: false,
    },
    {
      awardKey: "RETAIL_CHOICE",
      awardName: "Audience Retail Favorite",
      metric: "Most Broadly Distributed Retail Cap Table",
      isPublic: true,
      confirmedByAdmin: false,
    },
    {
      awardKey: "MOST_OVERSUBSCRIBED",
      awardName: "Highest Oversubscription Multiple",
      metric: "Total Funds Raised relative to Initial Ask",
      isPublic: true,
      confirmedByAdmin: false,
    },
  ];

  for (const award of awards) {
    await prisma.finalAward.create({ data: award });
  }

  // 6. Initial Activity Feed Notification
  await prisma.activityFeed.create({
    data: {
      type: "ADMIN_ACTION",
      message: "Vision Club Live Auditorium Edition trading floor initialized successfully.",
      isPublic: true,
    },
  });

  // 7. Seed Initial Market Liquidity for Open IPOs
  for (const s of startups) {
    if (s.ipoStatus === "IPO_OPEN") {
      await seedMarketLiquidityForStartup(s.id);
    }
  }

  console.log("✅ Seeding completed with 4 startups, 8 users, 5 awards, and initial market liquidity!");
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
