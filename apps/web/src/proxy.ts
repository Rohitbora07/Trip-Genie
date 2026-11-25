import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected route paths requiring authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/trips",
  "/saved-places",
  "/profile",
  "/activity",
  "/approvals",
  "/disruptions",
  "/settings",
];

// Auth route paths (redirect logged-in users away from these)
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for JWT auth cookie (Express cookie is tripgenie_auth or auth_token)
  const token =
    request.cookies.get("tripgenie_auth")?.value ||
    request.cookies.get("auth_token")?.value;

  const isAuthenticated = Boolean(token && token.length > 10);

  // 1. If accessing a protected route without valid session, redirect to /login
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If already authenticated and accessing login/register, redirect to /dashboard
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, svgs, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
