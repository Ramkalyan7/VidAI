import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("vidai-token")?.value;
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (!token && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (token && (pathname === "/login" || pathname === "/signup")) {
    const redirectTarget = request.nextUrl.searchParams.get("redirect");
    if (redirectTarget && redirectTarget.startsWith("/")) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/projects/:path*", "/chat/:path*"],
};
