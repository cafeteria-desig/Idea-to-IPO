import { prisma } from "../src/lib/prisma";

async function optimizeDb() {
  console.log("Setting SQLite PRAGMA journal_mode = WAL...");
  const mode = await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  console.log("Journal mode is now:", mode);

  console.log("Setting SQLite PRAGMA synchronous = NORMAL...");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");

  console.log("Setting SQLite PRAGMA busy_timeout = 10000...");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");

  console.log("Setting SQLite PRAGMA cache_size = -64000;"); // 64MB cache
  await prisma.$queryRawUnsafe("PRAGMA cache_size = -64000;");

  console.log("SQLite successfully optimized for high concurrency & low latency!");
}

optimizeDb().catch(console.error).finally(() => prisma.$disconnect());
