import { NextResponse } from "next/server";
import { db } from "@/db";
import { powerups } from "@/db/schema";
import { createPowerupSchema } from "@/schemas/powerups";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

/**
 * GET /api/powerups - Recupera tutti i powerup
 */
export async function GET() {
  try {
    const powerupsList = await db.select().from(powerups);
    return NextResponse.json(powerupsList, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero dei powerup:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/powerups - Crea un nuovo powerup (solo admin)
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

    const validation = createPowerupSchema.safeParse(json);
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

    const [existingPowerup] = await db
      .select()
      .from(powerups)
      .where(eq(powerups.name, body.name))
      .limit(1);

    if (existingPowerup) {
      return NextResponse.json(
        { message: "Un powerup con questo nome esiste già" },
        { status: 409 }
      );
    }

    const [newPowerup] = await db.insert(powerups).values(body).returning();

    return NextResponse.json(newPowerup, { status: 201 });
  } catch (error) {
    console.error("Errore durante la creazione del powerup:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
