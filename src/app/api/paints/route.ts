import { NextResponse } from "next/server";
import { db } from "@/db";
import { paints } from "@/db/schema";
import { createPaintSchema } from "@/schemas/paints";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

/**
 * GET /api/paints - Recupera tutte le vernici
 */
export async function GET() {
  try {
    const paintsList = await db.select().from(paints);
    return NextResponse.json(paintsList, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero delle vernici:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/paints - Crea una nuova vernice (solo admin)
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json(
        { message: "Accesso negato: solo per amministratori" },
        { status: 403 }
      );
    }

    const json = await request.json();

    const validation = createPaintSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validation.data;

    if (body.color) {
      const [existingPaint] = await db
        .select()
        .from(paints)
        .where(eq(paints.color, body.color))
        .limit(1);

      if (existingPaint) {
        return NextResponse.json(
          { message: "Una vernice con questo colore esiste già" },
          { status: 409 }
        );
      }
    }

    const [newPaint] = await db.insert(paints).values(body).returning();

    return NextResponse.json(newPaint, { status: 201 });
  } catch (error) {
    console.error("Errore durante la creazione della vernice:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
