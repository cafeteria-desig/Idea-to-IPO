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

  // 3. Startups / Teams
  const startups = [
    {
      id: "startup-campus-efix-1791404076617",
      name: "Campus Efix",
      slug: "campus-efix-1791404076617",
      logoUrl: null,
      tagLine: "Campus Innovation & Student Services Ecosystem",
      industry: "Technology & Innovation",
      problem: "Campus facilities and student service management inefficiencies.",
      solution: "Direct digitized ticketing and student innovation marketplace.",
      businessModel: "B2B Institution SaaS & Transaction fee model",
      targetMarket: "Higher Education Campuses Domestic & International",
      fundingAsk: 500000,
      equityOffered: 10,
      pitchSummary: "Campus innovation and digitized student service ecosystem with rapid on-campus adoption.",
      pitchDeckUrl: null,
      teamMembers: JSON.stringify([
        {
          name: "Campus Efix Core Team",
          role: "Founder / Lead Presenter",
          avatar: "",
          bio: "Pioneering Campus Efix",
        },
      ]),
      pitchOrder: 1,
      ipoStatus: "IPO_OPEN",
      initialPrice: 100,
      currentPrice: 197,
      previousPrice: 195,
      openPrice: 100,
      dayHigh: 201,
      dayLow: 100,
      totalShares: 50000,
      initialValuation: 5000000,
    },
    {
      id: "startup-campus-fix",
      name: "Campus Fix",
      slug: "campus-fix",
      logoUrl: null,
      tagLine: "College health is our health",
      industry: "AI & DeepTech",
      problem: "Complaint and maintenance tracking for college facilities",
      solution: "Real-time complaint tracking and SLA management for campus operations",
      businessModel: "B2B / B2C Revenue Generation & Scalable Unit Economics",
      targetMarket: "Domestic & International Enterprise/Consumer Markets",
      fundingAsk: 10000000,
      equityOffered: 10,
      pitchSummary: "Complaint resolution and infrastructure management platform.",
      pitchDeckUrl: null,
      teamMembers: JSON.stringify([
        {
          name: "Bhavik",
          role: "Founder / Lead Presenter",
          avatar: "",
          bio: "Pioneering Campus Fix",
        },
      ]),
      pitchOrder: 2,
      ipoStatus: "IPO_OPEN",
      initialPrice: 100,
      currentPrice: 148.54,
      previousPrice: 128.44,
      openPrice: 100,
      dayHigh: 148.54,
      dayLow: 100,
      totalShares: 1000000,
      initialValuation: 100000000,
    },
    {
      id: "startup-finflow",
      name: "FinFlow",
      slug: "finflow",
      logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200",
      tagLine: "AI-Powered Algorithmic Treasury & Cross-Border Liquidity Rails",
      industry: "Fintech & Web3",
      problem: "Cross-border B2B payouts take 3-5 business days with 4-7% FX spread losses and zero tracking visibility.",
      solution: "Autonomous liquidity routing protocol slashing cross-border settlement to 4 seconds and FX slippage to 15 bps.",
      businessModel: "0.25% transaction routing fee on volume + enterprise treasury dashboard tier at ₹75,000/mo.",
      targetMarket: "Global B2B payments market ($150T TAM), specifically targeting SMB cross-border export trade in APAC ($2.4T SAM).",
      fundingAsk: 10000000,
      equityOffered: 7.5,
      pitchSummary: "Processed $42M in pilot volume across 180 export houses with 28% MoM volume growth and zero default rate.",
      pitchDeckUrl: "https://example.com/pitch-decks/finflow-seed.pdf",
      teamMembers: JSON.stringify([
        {
          name: "Aarav Mehta",
          role: "CEO & Co-Founder",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          bio: "Ex-Goldman Sachs quant trader with 8 years in algorithmic FX execution.",
        },
        {
          name: "Dr. Sunita Rao",
          role: "Chief Technology Officer",
          avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
          bio: "PhD in Distributed Systems from IIT Bombay; 2 patents in distributed settlement channels.",
        },
      ]),
      pitchOrder: 3,
      ipoStatus: "IPO_OPEN",
      initialPrice: 100,
      currentPrice: 100,
      previousPrice: 100,
      openPrice: 100,
      dayHigh: 100,
      dayLow: 100,
      totalShares: 1000000,
      initialValuation: 100000000,
    },
    {
      id: "startup-greengo",
      name: "GreenGo",
      slug: "greengo",
      logoUrl: "https://images.unsplash.com/photo-1558441719-f832746429f5?w=200",
      tagLine: "Modular Fast-Swap Solid-State Battery Stations for Commercial 3-Wheelers",
      industry: "CleanTech & EV Mobility",
      problem: "Commercial EV rickshaw drivers lose 4.5 hours daily waiting at slow plug-in chargers, forfeiting 35% of net income.",
      solution: "Automated 90-second drive-through battery swap docks utilizing cloud-monitored solid-state cell packs.",
      businessModel: "Battery-as-a-Service (BaaS) subscription model charging ₹220/day per driver for unlimited swaps.",
      targetMarket: "Commercial last-mile passenger & delivery segment in Tier-1 & Tier-2 Indian urban hubs ($18B TAM).",
      fundingAsk: 15000000,
      equityOffered: 10.0,
      pitchSummary: "14 operational swap hubs in Bengaluru, 1,200 active auto drivers, over 280,000 battery swaps completed with 99.4% uptime.",
      pitchDeckUrl: "https://example.com/pitch-decks/greengo-seed.pdf",
      teamMembers: JSON.stringify([
        {
          name: "Karan Singhania",
          role: "Founder & CEO",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
          bio: "Former battery systems lead at Ather Energy; MIT mechanical engineering graduate.",
        },
        {
          name: "Neha Nair",
          role: "VP of Operations",
          avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
          bio: "Scaled logistics networks across 12 cities at Delhivery and Porter.",
        },
      ]),
      pitchOrder: 4,
      ipoStatus: "IPO_OPEN",
      initialPrice: 100,
      currentPrice: 100,
      previousPrice: 100,
      openPrice: 100,
      dayHigh: 100,
      dayLow: 100,
      totalShares: 1500000,
      initialValuation: 150000000,
    },
    {
      id: "startup-healthai",
      name: "HealthAI",
      slug: "healthai",
      logoUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200",
      tagLine: "Point-of-Care Neural Ultrasound Diagnostics for Rural Clinics",
      industry: "HealthTech & MedAI",
      problem: "70% of rural clinics lack certified sonologists, leading to late-stage obstetrics and cardiac diagnoses.",
      solution: "Handheld probe with real-time neural edge inference guiding frontline nurses to capture diagnostic scans in 3 minutes.",
      businessModel: "Low-cost hardware lease + ₹120 per automated scan diagnostic report.",
      targetMarket: "Primary healthcare clinics across South Asia and Sub-Saharan Africa ($8.5B TAM).",
      fundingAsk: 8000000,
      equityOffered: 6.0,
      pitchSummary: "Clinical trial with 12,000 scans across 32 clinics demonstrating 96.2% diagnostic accuracy compared to hospital CT scans.",
      pitchDeckUrl: "https://example.com/pitch-decks/healthai-seed.pdf",
      teamMembers: JSON.stringify([
        {
          name: "Dr. Vikram Seth",
          role: "Co-Founder & Chief Medical Officer",
          avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150",
          bio: "Consultant radiologist at AIIMS; 12 years clinical practice and health informatics researcher.",
        },
        {
          name: "Tanvi Deshmukh",
          role: "Co-Founder & Head of AI",
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          bio: "Ex-DeepMind research scientist focused on low-compute computer vision models.",
        },
      ]),
      pitchOrder: 5,
      ipoStatus: "IPO_OPEN",
      initialPrice: 100,
      currentPrice: 100,
      previousPrice: 100,
      openPrice: 100,
      dayHigh: 100,
      dayLow: 100,
      totalShares: 800000,
      initialValuation: 80000000,
    },
    {
      id: "startup-eduspark",
      name: "EduSpark",
      slug: "eduspark",
      logoUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=200",
      tagLine: "Adaptive Micro-Apprenticeship & Gamified Engineering Skill Exchange",
      industry: "EdTech & Workforce",
      problem: "82% of engineering graduates lack real-world production engineering skills demanded by tier-1 tech firms.",
      solution: "Live interactive codebase sandbox where students resolve production bugs alongside AI code reviewers.",
      businessModel: "Employer placement fees (10% of first-year compensation) + premium skill certifications.",
      targetMarket: "Higher education engineering students in India (1.5M annual graduates) and global tech recruiters ($4.2B SAM).",
      fundingAsk: 5000000,
      equityOffered: 5.0,
      pitchSummary: "45,000 active students, 320 candidates placed in top startups with a 91% 6-month retention rate.",
      pitchDeckUrl: "https://example.com/pitch-decks/eduspark-seed.pdf",
      teamMembers: JSON.stringify([
        {
          name: "Rohan Varma",
          role: "Co-Founder & CEO",
          avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
          bio: "Former engineering director at Unacademy; built developer education platforms serving 500k engineers.",
        },
        {
          name: "Simran Kaur",
          role: "Head of Product & Curriculum",
          avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
          bio: "Stanford learning design graduate; former pedagogy lead at Coursera.",
        },
      ]),
      pitchOrder: 6,
      ipoStatus: "IPO_OPEN",
      initialPrice: 100,
      currentPrice: 100,
      previousPrice: 100,
      openPrice: 100,
      dayHigh: 100,
      dayLow: 100,
      totalShares: 500000,
      initialValuation: 50000000,
    },
  ];
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
      startingCapital: 100000, // ₹1 Lakh
      currentBalance: 100000,
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
      startingCapital: 100000, // ₹1 Lakh
      currentBalance: 100000,
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
      startingCapital: 100000, // ₹1 Lakh
      currentBalance: 100000,
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

  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

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
