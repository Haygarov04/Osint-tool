import { NextRequest, NextResponse } from "next/server";
import { getSitePassword } from "@/lib/config";

const AUTH_COOKIE = "osint_auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correct = getSitePassword();

  if (!correct) {
    // No password configured → allow (dev mode)
    return NextResponse.json({ ok: true });
  }

  if (password === correct) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  }

  return NextResponse.json({ error: "Невалидна парола" }, { status: 401 });
}
