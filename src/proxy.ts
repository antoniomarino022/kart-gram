import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const allowedOrigins = [
  process.env.DASHBOARD_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
]
  .filter((url): url is string => Boolean(url))
  .map((url) => url.replace(/\/+$/, ""));

/**
 * Middleware per la gestione di CORS sulle API (solo origini autorizzate)
 */
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isAllowedOrigin = Boolean(origin && allowedOrigins.includes(origin));

  // Gestione richieste preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin) {
      return new NextResponse(null, { status: 403 });
    }

    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-admin-secret, Cookie",
    );
    response.headers.set("Access-Control-Max-Age", "86400");

    return response;
  }

  const response = NextResponse.next();

  if (isAllowedOrigin && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
