import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { createCharacterSchema } from "@/schemas/characters";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";
import { auth } from "@/lib/auth";

/**
 * GET /api/character - Recupera tutti i personaggi
 */
export async function GET() {
  try {
    const characterList = await db.select().from(characters);
    return NextResponse.json(characterList, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero dei personaggi:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/character - Crea un nuovo personaggio (solo admin)
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

    const validation = createCharacterSchema.safeParse(json);
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

    const [existingCharacter] = await db
      .select()
      .from(characters)
      .where(eq(characters.name, body.name))
      .limit(1);

    if (existingCharacter) {
      return NextResponse.json(
        { message: "Un personaggio con questo nome esiste già" },
        { status: 409 }
      );
    }

    const [newCharacter] = await db
      .insert(characters)
      .values(body)
      .returning();

    return NextResponse.json(newCharacter, { status: 201 });
  } catch (error) {
    console.error("Errore durante la creazione del personaggio:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
