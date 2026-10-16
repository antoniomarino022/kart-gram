import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware per la gestione universale di CORS sulle API
 */
export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // 1. Gestione richieste preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });

    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

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

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
