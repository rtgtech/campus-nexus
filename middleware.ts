import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "campusNexusToken";
const API_BASE_URL = process.env.CAMPUS_NEXUS_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:5000";

function authRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

async function tokenIsValid(token: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthRoute = request.nextUrl.pathname === "/auth";

  if (!token) {
    return isAuthRoute ? NextResponse.next() : authRedirect(request);
  }

  const isValid = await tokenIsValid(token);
  if (!isValid) {
    const response = isAuthRoute ? NextResponse.next() : authRedirect(request);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)"],
};
