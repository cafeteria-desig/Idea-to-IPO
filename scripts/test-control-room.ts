async function run() {
  console.log("Testing Complete Control Room Operations...");
  
  // 1. OPEN IPO
  const r1 = await fetch("http://localhost:3000/api/admin/startups/finflow/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ status: "IPO_OPEN", adminId: "user-admin" })
  });
  console.log("1. OPEN IPO status:", r1.status);
  const d1 = await r1.json();
  if (!d1.success) throw new Error("Failed OPEN IPO: " + JSON.stringify(d1));

  // 2. PAUSE IPO
  const r2 = await fetch("http://localhost:3000/api/admin/startups/startup-finflow/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ status: "IPO_PAUSED", adminId: "user-admin" })
  });
  console.log("2. PAUSE IPO status:", r2.status);
  const d2 = await r2.json();
  if (!d2.success) throw new Error("Failed PAUSE IPO: " + JSON.stringify(d2));

  // 3. CLOSE IPO
  const r3 = await fetch("http://localhost:3000/api/admin/startups/finflow/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ status: "IPO_CLOSED", adminId: "user-admin" })
  });
  console.log("3. CLOSE IPO status:", r3.status);
  const d3 = await r3.json();
  if (!d3.success) throw new Error("Failed CLOSE IPO: " + JSON.stringify(d3));

  // 4. Re-OPEN IPO
  const r4 = await fetch("http://localhost:3000/api/admin/startups/finflow/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ status: "IPO_OPEN", adminId: "user-admin" })
  });
  console.log("4. Re-OPEN IPO status:", r4.status);
  const d4 = await r4.json();
  if (!d4.success) throw new Error("Failed Re-OPEN IPO: " + JSON.stringify(d4));

  // 5. Market Freeze Toggle
  const r5 = await fetch("http://localhost:3000/api/admin/market/freeze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ isMarketActive: true, adminId: "user-admin" })
  });
  console.log("5. Freeze Toggle status:", r5.status);
  const d5 = await r5.json();
  if (!d5.success) throw new Error("Failed Freeze Toggle: " + JSON.stringify(d5));

  // 6. Liquidity Injection
  const r6 = await fetch("http://localhost:3000/api/admin/market/liquidity", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ startupId: "startup-finflow", adminId: "user-admin" })
  });
  console.log("6. Liquidity Injection status:", r6.status);
  const d6 = await r6.json();
  if (!d6.success) throw new Error("Failed Liquidity Injection: " + JSON.stringify(d6));

  // 7. Stock Trading Suspend / Unsuspend
  const r7 = await fetch("http://localhost:3000/api/admin/stocks/startup-finflow/suspend", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": "user-admin" },
    body: JSON.stringify({ isSuspended: false, adminId: "user-admin" })
  });
  console.log("7. Suspend Toggle status:", r7.status);
  const d7 = await r7.json();
  if (!d7.success) throw new Error("Failed Suspend Toggle: " + JSON.stringify(d7));

  console.log("\n=======================================================");
  console.log("ALL 7 CONTROL ROOM ACTIONS TESTED & VERIFIED (200 OK)!");
  console.log("=======================================================\n");
}

run().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
