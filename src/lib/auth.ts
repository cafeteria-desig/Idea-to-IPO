import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import type { SafeUser } from "@/types";

export const AUTH_COOKIE_NAME = "idea_ipo_user_id";
export const AUTH_COOKIE_MAX_AGE = 604800; // 7 days

export function sanitizeUser(user: any): SafeUser {
  const { password, ...safeUser } = user;
  return safeUser as SafeUser;
}

export async function getCurrentUser(request?: Request): Promise<SafeUser | null> {
  let userId: string | undefined | null = null;

  // 1. Check cookies
  try {
    const cookieStore = cookies();
    userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  } catch (e) {
    // In some edge API contexts cookies() might throw, fallback to headers
  }

  // 2. Check headers fallback if no cookie
  let headerUserId: string | null = null;
  if (request) {
    headerUserId = request.headers.get("x-user-id");
  }
  if (!headerUserId) {
    try {
      const headerStore = headers();
      headerUserId = headerStore.get("x-user-id");
    } catch (e) {
      // Ignored
    }
  }

  if (!userId) {
    userId = headerUserId;
  }

  if (!userId) {
    return null;
  }

  try {
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // If cookie userId did not match a real user in DB, check headerUserId
    if (!user && headerUserId && headerUserId !== userId) {
      user = await prisma.user.findUnique({
        where: { id: headerUserId },
      });
    }

    if (!user) {
      return null;
    }

    // Suspension interceptor: If status is BLOCKED, immediately reject
    if (user.status === "BLOCKED") {
      return null;
    }

    // Non-blocking heartbeat update to avoid read failures and SQLite write locks
    prisma.user
      .update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          isOnline: true,
        },
      })
      .catch(() => {});

    return sanitizeUser(user);
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return null;
  }
}

export function setAuthCookie(response: NextResponse, userId: string) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: userId,
    path: "/",
    sameSite: "lax",
    maxAge: AUTH_COOKIE_MAX_AGE,
    httpOnly: false, // Accessible to client context if needed
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Strict administrator resolver for mission control actions.
 * Only authorizes if the request has a valid, active session belonging to an ADMIN user.
 */
export async function getAdminUser(request?: Request, _fallbackAdminId?: string): Promise<SafeUser | null> {
  try {
    const user = await getCurrentUser(request);
    if (user && user.role === "ADMIN" && user.status === "ACTIVE") {
      return user;
    }

    if (_fallbackAdminId) {
      const fallbackUser = await prisma.user.findUnique({ where: { id: _fallbackAdminId } });
      if (fallbackUser && fallbackUser.role === "ADMIN" && fallbackUser.status === "ACTIVE") {
        return sanitizeUser(fallbackUser);
      }
    }

    return null;
  } catch (err) {
    console.error("getAdminUser error:", err);
    return null;
  }
}
