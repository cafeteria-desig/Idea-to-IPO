import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const defaultDatabaseUrl =
  "postgresql://postgres.ewovxvyhwekrtyyxravp:Bhavishy%402007@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15&pool_timeout=20&connect_timeout=15";

function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || defaultDatabaseUrl;
  if (!url.includes("connection_limit")) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}connection_limit=15&pool_timeout=20&connect_timeout=15`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = prisma;

