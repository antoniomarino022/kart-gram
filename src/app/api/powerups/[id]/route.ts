import { NextResponse } from "next/server";
import { db } from "@/db";
import { powerups } from "@/db/schema";
import { updatePowerupSchema } from "@/schemas/powerups";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/powerups/[id] - Recupera un singolo powerup per ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID powerup non valido" },
        { status: 400 }
      );
    }

    const [powerup] = await db
      .select()
      .from(powerups)
      .where(eq(powerups.id, numericId))
      .limit(1);

    if (!powerup) {
      return NextResponse.json(
        { message: "Powerup non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(powerup, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero del powerup:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/powerups/[id] - Aggiorna il powerup specificato dall'ID nell'URL
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json(
        { message: "Accesso negato: solo per amministratori" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID powerup non valido" },
        { status: 400 }
      );
    }

    const json = await request.json();
    const validation = updatePowerupSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const [existingPowerup] = await db
      .select()
      .from(powerups)
      .where(eq(powerups.id, numericId))
      .limit(1);

    if (!existingPowerup) {
      return NextResponse.json(
        { message: "Powerup non trovato" },
        { status: 404 }
      );
    }

    const [updatedPowerup] = await db
      .update(powerups)
      .set(validation.data)
      .where(eq(powerups.id, numericId))
      .returning();

    return NextResponse.json(updatedPowerup, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'aggiornamento del powerup:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/powerups/[id] - Elimina il powerup specificato dall'ID nell'URL
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json(
        { message: "Accesso negato: solo per amministratori" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID powerup non valido" },
        { status: 400 }
      );
    }

    const [existingPowerup] = await db
      .select()
      .from(powerups)
      .where(eq(powerups.id, numericId))
      .limit(1);

    if (!existingPowerup) {
      return NextResponse.json(
        { message: "Powerup non trovato" },
        { status: 404 }
      );
    }

    await db.delete(powerups).where(eq(powerups.id, numericId));
    return NextResponse.json({ message: "Powerup eliminato" }, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'eliminazione del powerup:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export { PUT as PATCH };
