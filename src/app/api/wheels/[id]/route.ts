import { NextResponse } from "next/server";
import { db } from "@/db";
import { wheels } from "@/db/schema";
import { updateWheelSchema } from "@/schemas/wheels";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/wheels/[id] - Recupera un singolo set di ruote per ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID ruote non valido" },
        { status: 400 }
      );
    }

    const [wheel] = await db
      .select()
      .from(wheels)
      .where(eq(wheels.id, numericId))
      .limit(1);

    if (!wheel) {
      return NextResponse.json(
        { message: "Ruote non trovate" },
        { status: 404 }
      );
    }

    return NextResponse.json(wheel, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero delle ruote:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wheels/[id] - Aggiorna le ruote specificate dall'ID nell'URL
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
        { message: "ID ruote non valido" },
        { status: 400 }
      );
    }

    const json = await request.json();
    const validation = updateWheelSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const [existingWheel] = await db
      .select()
      .from(wheels)
      .where(eq(wheels.id, numericId))
      .limit(1);

    if (!existingWheel) {
      return NextResponse.json(
        { message: "Ruote non trovate" },
        { status: 404 }
      );
    }

    const [updatedWheel] = await db
      .update(wheels)
      .set(validation.data)
      .where(eq(wheels.id, numericId))
      .returning();

    return NextResponse.json(updatedWheel, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'aggiornamento delle ruote:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wheels/[id] - Elimina le ruote specificate dall'ID nell'URL
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
        { message: "ID ruote non valido" },
        { status: 400 }
      );
    }

    const [existingWheel] = await db
      .select()
      .from(wheels)
      .where(eq(wheels.id, numericId))
      .limit(1);

    if (!existingWheel) {
      return NextResponse.json(
        { message: "Ruote non trovate" },
        { status: 404 }
      );
    }

    await db.delete(wheels).where(eq(wheels.id, numericId));
    return NextResponse.json({ message: "Ruote eliminate" }, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'eliminazione delle ruote:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export { PUT as PATCH };
