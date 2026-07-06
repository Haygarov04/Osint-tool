import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSitePassword } from "./lib/config";

// Simple password protection via cookie
const AUTH_COOKIE = "osint_auth";

export function middleware(request: NextRequest) {
  const password = getSitePassword();

  // If no password is set in env, allow everything (for local dev)
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow login page, API login, and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE)?.value;

  // If cookie is correct, allow
  if (authCookie === "1") {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
