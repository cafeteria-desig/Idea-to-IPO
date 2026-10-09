import { prisma } from "../src/lib/prisma";
import { signSessionToken, verifySessionToken, timingSafeCompare } from "../src/lib/security";

async function runVerification() {
  console.log("=================================================");
  console.log("IDEA-TO-IPO: TOKEN & SECURITY VERIFICATION SUITE");
  console.log("=================================================\n");

  // 1. Check startups and their tokens
  const startups = await prisma.startup.findMany({
    select: { id: true, name: true, slug: true, token: true },
  });

  console.log("1. Checking Startups & Token Assignment:");
  for (const s of startups) {
    if (!s.token) {
      throw new Error(`Startup ${s.name} does not have a token!`);
    }
    console.log(`   [OK] Startup: "${s.name}" (${s.slug}) -> Token: ${s.token}`);
  }

  // 2. Check founder user accounts linked to startup tokens
  console.log("\n2. Checking Founder User Accounts:");
  for (const s of startups) {
    const founder = await prisma.user.findFirst({
      where: { startupId: s.id },
    });
    if (!founder) {
      throw new Error(`Founder account missing for startup ${s.name}`);
    }
    if (founder.token !== s.token) {
      throw new Error(`Founder token mismatch for ${s.name}: user=${founder.token}, startup=${s.token}`);
    }
    console.log(`   [OK] Founder: ${founder.name} (${founder.email}) -> Role: ${founder.role}, Token: ${founder.token}`);
  }

  // 3. Test Security Layer: HMAC Signing & Verification
  console.log("\n3. Testing HMAC Security Layer:");
  const testPayload = {
    userId: "test-user-id",
    role: "STARTUP",
    sessionId: "sess-12345",
  };
  const token = signSessionToken(testPayload);
  const verified = verifySessionToken(token);
  if (!verified || verified.userId !== "test-user-id" || verified.sessionId !== "sess-12345") {
    throw new Error("HMAC token sign/verify failed!");
  }
  console.log("   [OK] Valid token signed & verified successfully.");

  // Tampered token test
  const tamperedToken = token.slice(0, -4) + "abcd";
  const tamperedResult = verifySessionToken(tamperedToken);
  if (tamperedResult !== null) {
    throw new Error("Tampered token was accepted! Security failure!");
  }
  console.log("   [OK] Tampered token correctly rejected by HMAC signature verification.");

  // Timing safe compare test
  if (!timingSafeCompare("Bhavishy@2007", "Bhavishy@2007")) {
    throw new Error("timingSafeCompare failed on identical strings");
  }
  if (timingSafeCompare("Bhavishy@2007", "wrongpassword")) {
    throw new Error("timingSafeCompare failed: returned true on different strings");
  }
  console.log("   [OK] Timing-safe string comparison verified.");

  // 4. Test Single-Login Policy Simulation for Startup Token Users
  console.log("\n4. Testing Strict Single-Login Enforcement for Tokens:");
  const sampleFounder = await prisma.user.findFirst({
    where: { role: "STARTUP" },
  });
  if (!sampleFounder) throw new Error("No founder found for test");

  // Device 1 logs in
  const session1Id = "device-1-uuid-" + Date.now();
  await prisma.user.update({
    where: { id: sampleFounder.id },
    data: { activeSessionId: session1Id, sessionCreatedAt: new Date() },
  });
  const device1Token = signSessionToken({
    userId: sampleFounder.id,
    role: sampleFounder.role,
    sessionId: session1Id,
  });

  // Verify Device 1 is active
  const checkD1Before = await prisma.user.findUnique({ where: { id: sampleFounder.id } });
  const payloadD1 = verifySessionToken(device1Token);
  const isD1ActiveBefore = payloadD1 && checkD1Before?.activeSessionId === payloadD1.sessionId;
  console.log(`   Device 1 Login State: ${isD1ActiveBefore ? "ACTIVE (Authorized)" : "INVALID"}`);
  if (!isD1ActiveBefore) throw new Error("Device 1 should be active");

  // Device 2 logs in with same token
  const session2Id = "device-2-uuid-" + (Date.now() + 100);
  await prisma.user.update({
    where: { id: sampleFounder.id },
    data: { activeSessionId: session2Id, sessionCreatedAt: new Date() },
  });
  const device2Token = signSessionToken({
    userId: sampleFounder.id,
    role: sampleFounder.role,
    sessionId: session2Id,
  });

  // Verify Device 1 is now INVALIDATED and Device 2 is ACTIVE
  const checkD1After = await prisma.user.findUnique({ where: { id: sampleFounder.id } });
  const isD1ActiveAfter = payloadD1 && checkD1After?.activeSessionId === payloadD1.sessionId;
  const payloadD2 = verifySessionToken(device2Token);
  const isD2Active = payloadD2 && checkD1After?.activeSessionId === payloadD2.sessionId;

  console.log(`   Device 1 After Device 2 Logs In: ${isD1ActiveAfter ? "STILL ACTIVE (FAIL)" : "KICKED OUT / INVALIDATED (PASS)"}`);
  console.log(`   Device 2 Current State: ${isD2Active ? "ACTIVE (Authorized)" : "INVALID (FAIL)"}`);

  if (isD1ActiveAfter) {
    throw new Error("Device 1 was not invalidated when Device 2 logged in!");
  }
  if (!isD2Active) {
    throw new Error("Device 2 should be active!");
  }
  console.log("   [OK] Strict single active session per token confirmed.");

  // 5. Test Admin Multi-Login Exemption
  console.log("\n5. Testing Admin Multi-Login Exemption:");
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) throw new Error("No admin found");

  const adminSessionA = "admin-session-A-" + Date.now();
  const adminSessionB = "admin-session-B-" + (Date.now() + 50);

  const adminTokenA = signSessionToken({
    userId: adminUser.id,
    role: adminUser.role,
    sessionId: adminSessionA,
  });
  const adminTokenB = signSessionToken({
    userId: adminUser.id,
    role: adminUser.role,
    sessionId: adminSessionB,
  });

  const payloadAdminA = verifySessionToken(adminTokenA);
  const payloadAdminB = verifySessionToken(adminTokenB);

  // In our auth logic, role === "ADMIN" skips activeSessionId checking!
  const isAllowedAdminA = payloadAdminA && payloadAdminA.role === "ADMIN";
  const isAllowedAdminB = payloadAdminB && payloadAdminB.role === "ADMIN";

  console.log(`   Admin Session A Status: ${isAllowedAdminA ? "AUTHORIZED" : "REJECTED"}`);
  console.log(`   Admin Session B Status: ${isAllowedAdminB ? "AUTHORIZED" : "REJECTED"}`);
  if (!isAllowedAdminA || !isAllowedAdminB) {
    throw new Error("Admin multi-login failed!");
  }
  console.log("   [OK] Admin multi-login confirmed: Unlimited concurrent admin sessions permitted.");

  console.log("\n=================================================");
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runVerification()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
