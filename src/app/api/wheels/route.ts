import { NextResponse } from "next/server";
import { db } from "@/db";
import { wheels } from "@/db/schema";
import { createWheelSchema } from "@/schemas/wheels";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

/**
 * GET /api/wheels - Recupera tutte le ruote
 */
export async function GET() {
  try {
    const wheelsList = await db.select().from(wheels);
    return NextResponse.json(wheelsList, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero delle ruote:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wheels - Crea nuove ruote (solo admin)
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

    const validation = createWheelSchema.safeParse(json);
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

    const [existingWheel] = await db
      .select()
      .from(wheels)
      .where(eq(wheels.name, body.name))
      .limit(1);

    if (existingWheel) {
      return NextResponse.json(
        { message: "Un set di ruote con questo nome esiste già" },
        { status: 409 }
      );
    }

    const [newWheel] = await db.insert(wheels).values(body).returning();

    return NextResponse.json(newWheel, { status: 201 });
  } catch (error) {
    console.error("Errore durante la creazione delle ruote:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
