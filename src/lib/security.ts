import crypto from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "idea-to-ipo-super-secure-key-2026-audit-club-vision";

export interface SessionPayload {
  userId: string;
  role: string;
  sessionId: string;
  createdAt?: number;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token:
 * format: <base64url(payload)>.<hex(hmac)>
 */
export function signSessionToken(payload: SessionPayload): string {
  const fullPayload = { ...payload, createdAt: payload.createdAt || Date.now() };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");
  return `${data}.${signature}`;
}

/**
 * Verifies a cryptographically signed session token.
 * Returns the decoded payload if valid and untampered, null otherwise.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(data).digest("hex");

    if (!timingSafeCompare(signature, expectedSignature)) {
      return null;
    }

    const jsonStr = Buffer.from(data, "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr) as SessionPayload;
    if (!payload.userId || !payload.sessionId) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Timing-safe string comparison to protect against timing attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Perform dummy constant-time comparison to avoid timing leakage
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * In-memory sliding window rate limiter to prevent brute-force attacks on login.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 60000
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterSec: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxAttempts - entry.count, retryAfterSec: 0 };
}
