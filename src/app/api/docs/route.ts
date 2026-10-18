import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi";

/**
 * GET /api/docs
 *
 * Restituisce la specifica JSON OpenAPI 3.0.3 utilizzata dalla pagina Swagger UI (`/docs`).
 */
export async function GET() {
  return NextResponse.json(openApiSpec);
}
