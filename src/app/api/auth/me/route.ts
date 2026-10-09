import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserDetailed } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { user, sessionInvalidated } = await getCurrentUserDetailed(req);
    if (sessionInvalidated) {
      return NextResponse.json(
        {
          user: null,
          sessionInvalidated: true,
          message:
            "Only one active login is allowed per token. You were signed out because this token was logged into from another device or tab.",
        },
        { status: 401 }
      );
    }
    return NextResponse.json({ user: user || null }, { status: 200 });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
