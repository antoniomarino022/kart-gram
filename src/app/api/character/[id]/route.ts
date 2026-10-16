import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters } from "@/db/schema";
import { updateCharacterSchema } from "@/schemas/characters";
import { eq } from "drizzle-orm";
import { flattenError } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/character/[id] - Recupera un singolo personaggio per ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID personaggio non valido" },
        { status: 400 }
      );
    }

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, numericId))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { message: "Personaggio non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(character, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero del personaggio:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/character/[id] - Aggiorna il personaggio specificato dall'ID nell'URL
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID personaggio non valido" },
        { status: 400 }
      );
    }

    const json = await request.json();
    const validation = updateCharacterSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Dati non validi",
          errors: flattenError(validation.error).fieldErrors,
        },
        { status: 400 }
      );
    }

    const [existingCharacter] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, numericId))
      .limit(1);

    if (!existingCharacter) {
      return NextResponse.json(
        { message: "Personaggio non trovato" },
        { status: 404 }
      );
    }

    const [updatedCharacter] = await db
      .update(characters)
      .set(validation.data)
      .where(eq(characters.id, numericId))
      .returning();

    return NextResponse.json(updatedCharacter, { status: 200 });
  } catch (error) {
    console.error("Errore durante l'aggiornamento del personaggio:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/character/[id] - Elimina il personaggio specificato dall'ID nell'URL
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);

    if (isNaN(numericId) || numericId <= 0) {
      return NextResponse.json(
        { message: "ID personaggio non valido" },
        { status: 400 }
      );
    }

    const [existingCharacter] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, numericId))
      .limit(1);

    if (!existingCharacter) {
      return NextResponse.json(
        { message: "Personaggio non trovato" },
        { status: 404 }
      );
    }

    await db.delete(characters).where(eq(characters.id, numericId));
    return NextResponse.json(
      { message: "Personaggio eliminato" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore durante l'eliminazione del personaggio:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export { PUT as PATCH };
