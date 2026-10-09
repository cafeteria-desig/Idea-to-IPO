import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking and assigning unique tokens for all startups...");

  const startups = await prisma.startup.findMany({
    orderBy: { pitchOrder: "asc" },
  });

  console.log(`Found ${startups.length} startups.`);

  for (const startup of startups) {
    let token = startup.token;
    if (!token || !/^\d{6}$/.test(token)) {
      // Find a unique 6-digit token
      let candidate = "";
      let unique = false;
      while (!unique) {
        candidate = String(Math.floor(100000 + Math.random() * 900000));
        const [existingStartup, existingUser] = await Promise.all([
          prisma.startup.findUnique({ where: { token: candidate } }),
          prisma.user.findFirst({ where: { token: candidate } }),
        ]);
        if (!existingStartup && !existingUser) {
          unique = true;
        }
      }

      await prisma.startup.update({
        where: { id: startup.id },
        data: { token: candidate },
      });
      token = candidate;
      console.log(`Assigned Token #${token} to startup "${startup.name}" (${startup.slug})`);
    } else {
      console.log(`Startup "${startup.name}" already has Token #${token}`);
    }

    // Upsert founder user with this token
    const founderEmail = `founder.${startup.slug}@ideaipo.com`;
    const existingFounder = await prisma.user.findFirst({
      where: {
        OR: [
          { startupId: startup.id },
          { email: founderEmail },
        ],
      },
    });

    if (existingFounder) {
      await prisma.user.update({
        where: { id: existingFounder.id },
        data: {
          token,
          password: token,
          startupId: startup.id,
          role: "STARTUP",
          status: "ACTIVE",
        },
      });
      console.log(`  Updated founder account for "${startup.name}" with Token #${token}`);
    } else {
      await prisma.user.create({
        data: {
          name: `${startup.name} Founder`,
          email: founderEmail,
          password: token,
          token,
          role: "STARTUP",
          status: "ACTIVE",
          startupId: startup.id,
          startingCapital: 0,
          currentBalance: 0,
          totalInvested: 0,
          isOnline: false,
        },
      });
      console.log(`  Created founder account for "${startup.name}" (${founderEmail}) with Token #${token}`);
    }
  }

  console.log("Finished assigning tokens to all startups!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
