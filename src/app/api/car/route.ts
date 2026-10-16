import { NextResponse } from "next/server";
import { db } from "@/db";
import { cars } from "@/db/schema";
import { createCarSchema } from "@/schemas/cars";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

/**
 * GET /api/car - Recupera tutte le auto
 */
export async function GET() {
  try {
    const carsList = await db.select().from(cars);
    return NextResponse.json(carsList, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero delle auto:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/car - Crea una nuova auto (solo admin)
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

    const validation = createCarSchema.safeParse(json);
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

    const [existingCar] = await db
      .select()
      .from(cars)
      .where(eq(cars.name, body.name))
      .limit(1);

    if (existingCar) {
      return NextResponse.json(
        { message: "Un'auto con questo nome esiste già" },
        { status: 409 }
      );
    }

    const [newCar] = await db.insert(cars).values(body).returning();

    return NextResponse.json(newCar, { status: 201 });
  } catch (error) {
    console.error("Errore durante la creazione dell'auto:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
