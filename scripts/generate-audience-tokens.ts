import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { USER_TOKEN_MAP } from "../src/lib/tokens";

const prisma = new PrismaClient();

async function main() {
  console.log("Generating 150 unique Audience tokens...");

  // 1. Collect all currently used tokens and emails
  const existingUsers = await prisma.user.findMany({
    select: { token: true, email: true },
  });

  const usedTokens = new Set<string>();
  const usedEmails = new Set<string>();

  existingUsers.forEach((u) => {
    if (u.token) usedTokens.add(u.token);
    if (u.email) usedEmails.add(u.email.toLowerCase().trim());
  });

  Object.values(USER_TOKEN_MAP).forEach((tok) => usedTokens.add(tok));

  // 2. Generate 150 unique 6-digit tokens
  const newAudienceRecords = [];
  const TARGET_COUNT = 150;

  for (let i = 1; i <= TARGET_COUNT; i++) {
    const padNum = String(i).padStart(3, "0");
    const email = `audience${padNum}@ideaipo.com`;
    const name = `Audience #${padNum}`;

    let token = "";
    while (!token || usedTokens.has(token)) {
      token = String(Math.floor(100000 + Math.random() * 900000));
    }
    usedTokens.add(token);

    newAudienceRecords.push({
      id: `user-audience-${padNum}`,
      name,
      email,
      password: token, // can log in with password or 6-digit token
      token,
      role: "RETAIL",
      status: "ACTIVE",
      startingCapital: 500000, // ₹5,00,000 (₹5 Lakhs)
      currentBalance: 500000,
      totalInvested: 0,
      isOnline: false,
    });
  }

  // 3. Upsert / Insert records into SQLite
  console.log(`Inserting ${newAudienceRecords.length} audience accounts into database...`);
  for (const record of newAudienceRecords) {
    await prisma.user.upsert({
      where: { email: record.email },
      update: {
        name: record.name,
        password: record.password,
        token: record.token,
        role: "RETAIL",
        status: "ACTIVE",
        startingCapital: 500000,
        currentBalance: 500000,
      },
      create: record,
    });
  }

  // Also assign explicit DB tokens to legacy retail accounts if they don't have one
  await prisma.user.updateMany({
    where: { email: "retail1@ideaipo.com", token: null },
    data: { token: "739214", password: "retail" },
  });
  await prisma.user.updateMany({
    where: { email: "retail2@ideaipo.com", token: null },
    data: { token: "482051", password: "retail" },
  });
  await prisma.user.updateMany({
    where: { email: "retail3@ideaipo.com", token: null },
    data: { token: "915638", password: "retail" },
  });

  console.log("✅ Successfully registered 150 Audience users in database!");

  // 4. Fetch all audience / retail users in the database
  const allAudienceUsers = await prisma.user.findMany({
    where: { role: "RETAIL" },
    orderBy: { email: "asc" },
  });

  console.log(`Total retail / audience users currently in DB: ${allAudienceUsers.length}`);

  // 5. Prepare Excel rows
  const excelData = allAudienceUsers.map((u, idx) => ({
    "S.No": idx + 1,
    "Audience Identifier": u.name,
    "6-Digit Passkey Token": u.token || "N/A",
    "Assigned Role": "Audience / Retail",
    "Starting Capital": "₹5,00,000",
    "Current Balance": `₹${u.currentBalance.toLocaleString("en-IN")}`,
    "Email ID": u.email,
    "Login URL": "https://valve-brave-learned-calling.trycloudflare.com",
    "Status": u.status,
  }));

  // Create Workbook
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths for beauty
  worksheet["!cols"] = [
    { wch: 8 },  // S.No
    { wch: 24 }, // Identifier
    { wch: 22 }, // Token
    { wch: 22 }, // Role
    { wch: 18 }, // Starting Capital
    { wch: 18 }, // Balance
    { wch: 28 }, // Email
    { wch: 45 }, // Login URL
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Audience Tokens");

  // Output paths
  const rootExcelPath = path.join(process.cwd(), "Audience_Tokens_List.xlsx");
  const publicExcelPath = path.join(process.cwd(), "public", "Audience_Tokens_List.xlsx");
  const publicCsvPath = path.join(process.cwd(), "public", "Audience_Tokens_List.csv");

  XLSX.writeFile(workbook, rootExcelPath);
  XLSX.writeFile(workbook, publicExcelPath);

  // Also write CSV for convenience
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  fs.writeFileSync(publicCsvPath, csvContent, "utf8");

  console.log(`📁 Excel file created at: ${rootExcelPath}`);
  console.log(`📁 Public download URL: /Audience_Tokens_List.xlsx`);
  console.log(`📁 CSV file created at: ${publicCsvPath}`);
}

main()
  .catch((e) => {
    console.error("Error generating tokens:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
