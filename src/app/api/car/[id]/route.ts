import { NextResponse } from "next/server";
import { db } from "@/db";
import { cars } from "@/db/schema";
import { updateCarSchema } from "@/schemas/cars";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/car/[id] - Recupera una singola auto per ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID auto non valido" },
        { status: 400 }
      );
    }

    const [car] = await db
      .select()
      .from(cars)
      .where(eq(cars.id, numericId))
      .limit(1);

    if (!car) {
      return NextResponse.json(
        { message: "Auto non trovata" },
        { status: 404 }
      );
    }

    return NextResponse.json(car, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero dell'auto:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/car/[id] - Aggiorna l'auto specificata dall'ID nell'URL
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
        { message: "ID auto non valido" },
        { status: 400 }
      );
    }

    const json = await request.json();
    const validation = updateCarSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const [existingCar] = await db
      .select()
      .from(cars)
      .where(eq(cars.id, numericId))
      .limit(1);

    if (!existingCar) {
      return NextResponse.json(
        { message: "Auto non trovata" },
        { status: 404 }
      );
    }

    const [updatedCar] = await db
      .update(cars)
      .set(validation.data)
      .where(eq(cars.id, numericId))
      .returning();

    return NextResponse.json(updatedCar, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'aggiornamento dell'auto:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/car/[id] - Elimina l'auto specificata dall'ID nell'URL
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
        { message: "ID auto non valido" },
        { status: 400 }
      );
    }

    const [existingCar] = await db
      .select()
      .from(cars)
      .where(eq(cars.id, numericId))
      .limit(1);

    if (!existingCar) {
      return NextResponse.json(
        { message: "Auto non trovata" },
        { status: 404 }
      );
    }

    await db.delete(cars).where(eq(cars.id, numericId));
    return NextResponse.json({ message: "Auto eliminata" }, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'eliminazione dell'auto:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export { PUT as PATCH };
