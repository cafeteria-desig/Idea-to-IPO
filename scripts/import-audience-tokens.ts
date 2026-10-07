import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Reading Audience_Tokens_List.xlsx...");
  const excelPath = path.join(process.cwd(), "Audience_Tokens_List.xlsx");
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`Found ${rows.length} rows in Excel file.`);

  const audienceList: {
    sNo: number;
    name: string;
    token: string;
    role: string;
    email: string;
    startingCapital: number;
    currentBalance: number;
  }[] = [];

  for (const row of rows) {
    const sNo = Number(row["S.No"]);
    const name = String(row["Audience Identifier"] || "").trim();
    const token = String(row["6-Digit Passkey Token"] || "").trim();
    const email = String(row["Email ID"] || "").toLowerCase().trim();
    
    // Parse currency strings like "₹5,00,000"
    const parseCurrency = (val: any) => {
      if (typeof val === "number") return val;
      const clean = String(val || "").replace(/[^\d.]/g, "");
      return clean ? parseFloat(clean) : 500000;
    };

    const startingCapital = parseCurrency(row["Starting Capital"]);
    const currentBalance = parseCurrency(row["Current Balance"]);

    if (!token || token.length !== 6) {
      console.warn(`Row ${sNo} (${name}) has invalid token: ${token}`);
    }

    audienceList.push({
      sNo,
      name,
      token,
      role: "RETAIL",
      email,
      startingCapital,
      currentBalance,
    });
  }

  console.log(`Parsed ${audienceList.length} audience records.`);

  // 1. Save all to database (Upsert so we preserve any existing trading history/balances if already active)
  console.log("Upserting audience users into database...");
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of audienceList) {
    const existing = await prisma.user.findUnique({
      where: { email: item.email },
    });

    if (existing) {
      // Ensure token and password are set to passkey token
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          token: item.token,
          // If retail user already has password "retail", keep it or allow token
          name: existing.name || item.name,
          role: "RETAIL",
          status: "ACTIVE",
        },
      });
      updatedCount++;
    } else {
      const padNum = String(item.sNo).padStart(3, "0");
      await prisma.user.create({
        data: {
          id: `user-audience-${padNum}`,
          name: item.name,
          email: item.email,
          password: item.token, // Can log in with token directly
          token: item.token,
          role: "RETAIL",
          status: "ACTIVE",
          startingCapital: item.startingCapital,
          currentBalance: item.currentBalance,
          totalInvested: 0,
          isOnline: false,
        },
      });
      createdCount++;
    }
  }

  console.log(`✅ Database updated: ${createdCount} created, ${updatedCount} updated.`);

  // 2. Export audience tokens to src/data/audience-tokens.json
  const dataDir = path.join(process.cwd(), "src", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const jsonPath = path.join(dataDir, "audience-tokens.json");
  fs.writeFileSync(jsonPath, JSON.stringify(audienceList, null, 2), "utf8");
  console.log(`✅ Saved static JSON data to: ${jsonPath}`);

  // 3. Update Excel & CSV with live tunnel URL
  const LIVE_URL = "https://nevertheless-hence-improvements-connections.trycloudflare.com";
  const updatedExcelData = audienceList.map((item) => ({
    "S.No": item.sNo,
    "Audience Identifier": item.name,
    "6-Digit Passkey Token": item.token,
    "Assigned Role": "Audience / Retail",
    "Starting Capital": `₹${item.startingCapital.toLocaleString("en-IN")}`,
    "Current Balance": `₹${item.currentBalance.toLocaleString("en-IN")}`,
    "Email ID": item.email,
    "Login URL": LIVE_URL,
    "Status": "ACTIVE",
  }));

  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(updatedExcelData);
  newSheet["!cols"] = [
    { wch: 8 },  // S.No
    { wch: 24 }, // Identifier
    { wch: 24 }, // Token
    { wch: 20 }, // Role
    { wch: 18 }, // Starting Capital
    { wch: 18 }, // Balance
    { wch: 28 }, // Email
    { wch: 65 }, // Login URL
    { wch: 12 }, // Status
  ];

  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Audience Tokens");

  const rootExcelPath = path.join(process.cwd(), "Audience_Tokens_List.xlsx");
  const publicExcelPath = path.join(process.cwd(), "public", "Audience_Tokens_List.xlsx");
  const publicCsvPath = path.join(process.cwd(), "public", "Audience_Tokens_List.csv");

  XLSX.writeFile(newWorkbook, rootExcelPath);
  XLSX.writeFile(newWorkbook, publicExcelPath);

  const csvContent = XLSX.utils.sheet_to_csv(newSheet);
  fs.writeFileSync(publicCsvPath, csvContent, "utf8");

  console.log(`✅ Excel files updated with live tunnel link: ${LIVE_URL}`);
  console.log(`✅ CSV file updated at: ${publicCsvPath}`);
}

main()
  .catch((e) => {
    console.error("Import error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
