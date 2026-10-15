"use server";

import { db } from "@/db";
import { characters } from "@/db/schema";
import { CharacterResponse } from "@/schemas/characters";
import { handleActionError } from "@/utils/errors";
import { eq } from "drizzle-orm";

/**
 * Recupera la lista di tutti i characters dal database
 */
export async function getCharacters(): Promise<CharacterResponse[]> {
  try {
    const charactersList = await db.select().from(characters);
    return charactersList;
  } catch (error) {
    handleActionError(error, "Impossibile recuperare la lista dei personaggi.");
  }
}

/**
 * Recupera un singolo character dal database tramite ID
 */
export async function getCharacterById(id: number): Promise<CharacterResponse> {
  try {
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .limit(1);

    if (!character) {
      throw new Error(`Personaggio con id ${id} non trovato.`);
    }

    return character;
  } catch (error) {
    handleActionError(error, "Impossibile recuperare il personaggio.");
  }
}
