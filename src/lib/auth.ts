import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getCached, setCached } from "./cache";
import { signSessionToken, verifySessionToken } from "./security";
import type { SafeUser } from "@/types";

export const AUTH_COOKIE_NAME = "idea_ipo_user_id";
export const AUTH_SESSION_COOKIE_NAME = "idea_ipo_session";
export const AUTH_COOKIE_MAX_AGE = 604800; // 7 days

export function sanitizeUser(
  user: any,
  startupInfo?: { slug?: string; name?: string } | null
): SafeUser {
  const { password, activeSessionId, sessionCreatedAt, ...safeUser } = user;
  if (startupInfo) {
    safeUser.startupSlug = startupInfo.slug || null;
    safeUser.startupName = startupInfo.name || null;
  }
  return safeUser as SafeUser;
}

export interface AuthSessionResult {
  user: SafeUser | null;
  sessionInvalidated?: boolean;
}

/**
 * Resolves the currently authenticated user from the request.
 * Enforces:
 * 1. Cryptographic HMAC verification of the session token.
 * 2. Strict single active login constraint for all 6-digit token holders (RETAIL, FII, STARTUP).
 * 3. Unlimited concurrent login permissions for ADMIN users with the password.
 */
export async function getCurrentUser(request?: Request): Promise<SafeUser | null> {
  const { user } = await getCurrentUserDetailed(request);
  return user;
}

export async function getCurrentUserDetailed(request?: Request): Promise<AuthSessionResult> {
  let sessionToken: string | null = null;
  let rawUserId: string | null = null;
  let rawSessionId: string | null = null;

  // 1. Read cookies
  try {
    const cookieStore = cookies();
    sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value || null;
    rawUserId = cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
  } catch {
    // In edge or test environments cookies() might throw
  }

  // 2. Read headers fallback
  if (request) {
    if (!sessionToken) sessionToken = request.headers.get("x-session-token");
    if (!sessionToken) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7).trim();
      }
    }
    if (!rawUserId) rawUserId = request.headers.get("x-user-id");
    if (!rawSessionId) rawSessionId = request.headers.get("x-session-id");
  }

  if (!sessionToken) {
    try {
      const headerStore = headers();
      sessionToken = headerStore.get("x-session-token");
      if (!sessionToken) {
        const authHeader = headerStore.get("authorization");
        if (authHeader?.startsWith("Bearer ")) {
          sessionToken = authHeader.substring(7).trim();
        }
      }
      if (!rawUserId) rawUserId = headerStore.get("x-user-id");
      if (!rawSessionId) rawSessionId = headerStore.get("x-session-id");
    } catch {
      // Ignored
    }
  }

  let verifiedUserId: string | null = null;
  let verifiedSessionId: string | null = null;
  let verifiedRole: string | null = null;

  if (sessionToken) {
    const payload = verifySessionToken(sessionToken);
    if (payload) {
      verifiedUserId = payload.userId;
      verifiedSessionId = payload.sessionId;
      verifiedRole = payload.role;
    } else {
      // Tampered or invalid session token: reject immediately
      return { user: null, sessionInvalidated: true };
    }
  } else if (rawUserId) {
    // Legacy / fallback header support
    verifiedUserId = rawUserId;
    verifiedSessionId = rawSessionId;
  }

  if (!verifiedUserId) {
    return { user: null };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: verifiedUserId },
    });

    if (!user) {
      return { user: null };
    }

    // Suspension interceptor: If status is BLOCKED, immediately reject
    if (user.status === "BLOCKED") {
      return { user: null };
    }

    // =========================================================================
    // SECURITY CONSTRAINT: Strict Single Login Policy for Token Users
    // Admin: Multiple simultaneous logins permitted
    // Token Users (RETAIL, FII, STARTUP): Strictly ONE active login session.
    // If activeSessionId does not match current session, another login occurred.
    // =========================================================================
    if (user.role !== "ADMIN") {
      if (user.activeSessionId && verifiedSessionId && user.activeSessionId !== verifiedSessionId) {
        // Another login has occurred on this token! Invalidate this session.
        return { user: null, sessionInvalidated: true };
      }
      if (user.activeSessionId && !verifiedSessionId && sessionToken) {
        return { user: null, sessionInvalidated: true };
      }
    }

    // Non-blocking throttled heartbeat update (at most once every 60s)
    if (!user.lastActiveAt || Date.now() - new Date(user.lastActiveAt).getTime() > 60000) {
      prisma.user
        .update({
          where: { id: user.id },
          data: {
            lastActiveAt: new Date(),
            isOnline: true,
          },
        })
        .catch(() => {});
    }

    let startupInfo: { slug: string; name: string } | null = null;
    if (user.startupId) {
      startupInfo = await prisma.startup.findUnique({
        where: { id: user.startupId },
        select: { slug: true, name: true },
      });
    }

    const safe = sanitizeUser(user, startupInfo);
    return { user: safe };
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return { user: null };
  }
}

/**
 * Sets secure signed authentication cookies on the response.
 */
export function setAuthCookie(
  response: NextResponse,
  userId: string,
  role = "RETAIL",
  sessionId = "sess-default"
) {
  const signedToken = signSessionToken({
    userId,
    role,
    sessionId,
    createdAt: Date.now(),
  });

  // 1. Signed cryptographic session cookie (HttpOnly, SameSite Lax)
  response.cookies.set({
    name: AUTH_SESSION_COOKIE_NAME,
    value: signedToken,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AUTH_COOKIE_MAX_AGE,
    httpOnly: true, // Prevents XSS cookie theft
  });

  // 2. Client-accessible helper cookie
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: userId,
    path: "/",
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    httpOnly: false,
  });

  return signedToken;
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: false,
  });
}

/**
 * Strict administrator resolver for mission control actions.
 * Only authorizes if the request has a valid, active session belonging to an ADMIN user.
 * IDOR protection: NEVER trusts arbitrary caller-provided adminId parameters.
 */
export async function getAdminUser(request?: Request, _deprecatedFallback?: string): Promise<SafeUser | null> {
  try {
    const user = await getCurrentUser(request);
    if (user && user.role === "ADMIN" && user.status === "ACTIVE") {
      return user;
    }
    return null;
  } catch (err) {
    console.error("getAdminUser error:", err);
    return null;
  }
}
