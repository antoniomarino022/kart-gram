import { NextResponse } from "next/server";
import { db } from "@/db";
import { maps } from "@/db/schema";
import { updateMapSchema } from "@/schemas/maps";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/maps/[id] - Recupera una singola mappa per ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID mappa non valido" },
        { status: 400 }
      );
    }

    const [map] = await db
      .select()
      .from(maps)
      .where(eq(maps.id, numericId))
      .limit(1);

    if (!map) {
      return NextResponse.json(
        { message: "Mappa non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(map, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero della mappa:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/maps/[id] - Aggiorna la mappa specificata dall'ID nell'URL
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
        { message: "ID mappa non valido" },
        { status: 400 }
      );
    }

    const json = await request.json();
    const validation = updateMapSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const [existingMap] = await db
      .select()
      .from(maps)
      .where(eq(maps.id, numericId))
      .limit(1);

    if (!existingMap) {
      return NextResponse.json(
        { message: "Mappa non trovata" },
        { status: 404 }
      );
    }

    const [updatedMap] = await db
      .update(maps)
      .set(validation.data)
      .where(eq(maps.id, numericId))
      .returning();

    return NextResponse.json(updatedMap, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'aggiornamento della mappa:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/maps/[id] - Elimina la mappa specificata dall'ID nell'URL
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
        { message: "ID mappa non valido" },
        { status: 400 }
      );
    }

    const [existingMap] = await db
      .select()
      .from(maps)
      .where(eq(maps.id, numericId))
      .limit(1);

    if (!existingMap) {
      return NextResponse.json(
        { message: "Mappa non trovata" },
        { status: 404 }
      );
    }

    await db.delete(maps).where(eq(maps.id, numericId));
    return NextResponse.json({ message: "Mappa eliminata" }, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'eliminazione della mappa:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export { PUT as PATCH };
