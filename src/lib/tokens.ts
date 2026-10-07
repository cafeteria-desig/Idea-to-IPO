import audienceTokens from "@/data/audience-tokens.json";

// 6-digit token registry and resolver for direct portal logins

/**
 * Generates a truly random 6-digit number string between 100000 and 999999.
 */
export function generateRandomToken(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Map of all audience tokens from the official 153 audience roster
const AUDIENCE_TOKEN_MAP: Record<string, string> = {};
for (const item of (audienceTokens as Array<{ email: string; token: string }>)) {
  if (item.email && item.token) {
    AUDIENCE_TOKEN_MAP[item.email.toLowerCase().trim()] = item.token;
  }
}

export const USER_TOKEN_MAP: Record<string, string> = {
  ...AUDIENCE_TOKEN_MAP,

  // Audience / Retail Tokens (Randomized 6 digits)
  "retail1@ideaipo.com": "739214",
  "retail2@ideaipo.com": "482051",
  "retail3@ideaipo.com": "915638",
  "retail4@ideaipo.com": "264893",
  "retail5@ideaipo.com": "581427",

  // VC Judge / Institutional Tokens (Randomized 6 digits)
  "fii1@ideaipo.com": "837195",
  "fii2@ideaipo.com": "394820",
  "fii3@ideaipo.com": "620174",
  "vanguard@ideaipo.com": "451982",
  "nexus@ideaipo.com": "716304",

  // Startup Founder Tokens (Randomized 6 digits)
  "founder.finflow@ideaipo.com": "529461",
  "founder.greengo@ideaipo.com": "840273",
  "founder.healthai@ideaipo.com": "361958",
  "founder.novamed@ideaipo.com": "194825",
  "founder.zenith@ideaipo.com": "672409",
};

/**
 * Returns the active 6-digit login token or admin credential for any given user.
 */
export function getUserLoginToken(user: { id?: string; email?: string | null; role?: string; token?: string | null }): string {
  if (user.role === "ADMIN" || user.email === "admin@ideaipo.com") {
    return "Pass: Bhavishy@2007";
  }

  if (user.token && String(user.token).trim()) {
    return String(user.token).trim();
  }

  const cleanEmail = (user.email || "").toLowerCase().trim();
  if (cleanEmail && USER_TOKEN_MAP[cleanEmail]) {
    return USER_TOKEN_MAP[cleanEmail];
  }

  // Pseudo-random fallback generator for any custom user without a DB token yet
  let hash = 5381;
  const seedStr = cleanEmail || user.id || "investor";
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 33) ^ seedStr.charCodeAt(i);
  }
  const random6Digit = 100000 + (Math.abs(hash) % 900000);
  return String(random6Digit);
}

/**
 * Returns the raw 6-digit token number or fallback ID (e.g. "739214").
 */
export function getUserTokenOnly(user?: { id?: string; email?: string | null; role?: string; token?: string | null } | null): string {
  if (!user) return "";
  if (user.token && String(user.token).trim()) {
    return String(user.token).trim();
  }
  const cleanEmail = (user.email || "").toLowerCase().trim();
  if (cleanEmail && USER_TOKEN_MAP[cleanEmail]) {
    return USER_TOKEN_MAP[cleanEmail];
  }
  if (user.role === "ADMIN" || cleanEmail === "admin@ideaipo.com") {
    return "ADMIN";
  }
  let hash = 5381;
  const seedStr = cleanEmail || user.id || "investor";
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 33) ^ seedStr.charCodeAt(i);
  }
  const random6Digit = 100000 + (Math.abs(hash) % 900000);
  return String(random6Digit);
}

/**
 * Returns a privacy-safe user display ID.
 * When a user is using their panel, do NOT show their real name; only show the token number.
 * e.g., "Token #739214".
 * For Event Director, returns "Event Director".
 */
export function getUserDisplayIdentifier(user?: { id?: string; email?: string | null; role?: string; token?: string | null; name?: string } | null): string {
  if (!user) return "";
  if (user.role === "ADMIN" || (user.email && String(user.email).toLowerCase().trim() === "admin@ideaipo.com")) {
    return "Event Director";
  }
  const token = getUserTokenOnly(user);
  return token ? `Token #${token}` : `User #${user.id?.slice(-6) || "ID"}`;
}

