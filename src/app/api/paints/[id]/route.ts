import { NextResponse } from "next/server";
import { db } from "@/db";
import { paints } from "@/db/schema";
import { updatePaintSchema } from "@/schemas/paints";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/paints/[id] - Recupera una singola vernice per ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID vernice non valido" },
        { status: 400 }
      );
    }

    const [paint] = await db
      .select()
      .from(paints)
      .where(eq(paints.id, numericId))
      .limit(1);

    if (!paint) {
      return NextResponse.json(
        { message: "Vernice non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(paint, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero della vernice:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/paints/[id] - Aggiorna la vernice specificata dall'ID nell'URL
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
        { message: "ID vernice non valido" },
        { status: 400 }
      );
    }

    const json = await request.json();
    const validation = updatePaintSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const [existingPaint] = await db
      .select()
      .from(paints)
      .where(eq(paints.id, numericId))
      .limit(1);

    if (!existingPaint) {
      return NextResponse.json(
        { message: "Vernice non trovata" },
        { status: 404 }
      );
    }

    const [updatedPaint] = await db
      .update(paints)
      .set(validation.data)
      .where(eq(paints.id, numericId))
      .returning();

    return NextResponse.json(updatedPaint, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'aggiornamento della vernice:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/paints/[id] - Elimina la vernice specificata dall'ID nell'URL
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
        { message: "ID vernice non valido" },
        { status: 400 }
      );
    }

    const [existingPaint] = await db
      .select()
      .from(paints)
      .where(eq(paints.id, numericId))
      .limit(1);

    if (!existingPaint) {
      return NextResponse.json(
        { message: "Vernice non trovata" },
        { status: 404 }
      );
    }

    await db.delete(paints).where(eq(paints.id, numericId));
    return NextResponse.json({ message: "Vernice eliminata" }, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'eliminazione della vernice:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export { PUT as PATCH };
