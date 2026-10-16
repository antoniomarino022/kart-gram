import { NextResponse } from "next/server";
import { db } from "@/db";
import { maps } from "@/db/schema";
import { createMapSchema } from "@/schemas/maps";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

/**
 * GET /api/maps - Recupera tutte le mappe
 */
export async function GET() {
  try {
    const mapsList = await db.select().from(maps);
    return NextResponse.json(mapsList, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero delle mappe:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maps - Crea una nuova mappa (solo admin)
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

    const validation = createMapSchema.safeParse(json);
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

    const [existingMap] = await db
      .select()
      .from(maps)
      .where(eq(maps.name, body.name))
      .limit(1);

    if (existingMap) {
      return NextResponse.json(
        { message: "Una mappa con questo nome esiste già" },
        { status: 409 }
      );
    }

    const [newMap] = await db.insert(maps).values(body).returning();

    return NextResponse.json(newMap, { status: 201 });
  } catch (error) {
    console.error("Errore durante la creazione della mappa:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
