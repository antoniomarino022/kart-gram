"use server";

import { db } from "@/db";
import { characters, userItems, users } from "@/db/schema";
import {
  EquipCharacterInput,
  equipCharacterSchema,
} from "@/schemas/characters";
import { UserResponse } from "@/schemas/users";
import { UnlockType } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq } from "drizzle-orm";


/**
 * Equipaggia / Seleziona un personaggio per l'utente
 * Verifica che il personaggio esista e che l'utente lo possieda (o sia FREE)
 */
export async function equipCharacter(
  data: EquipCharacterInput
): Promise<UserResponse> {
  try {
    const validated = equipCharacterSchema.parse(data);

    // Verifica esistenza del personaggio
    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, validated.characterId),
          eq(characters.isActive, true)
        )
      )
      .limit(1);

    if (!character) {
      throw new Error("Il personaggio selezionato non esiste o non è attivo.");
    }

    // Se il personaggio non è FREE, verifica che l'utente lo possieda in User_Items
    if (character.unlockType !== UnlockType.FREE) {
      const [owned] = await db
        .select()
        .from(userItems)
        .where(
          and(
            eq(userItems.userId, validated.userId),
            eq(userItems.characterId, validated.characterId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new Error(
          "Non puoi equipaggiare un personaggio che non hai ancora sbloccato."
        );
      }
    }

    // Aggiorna il personaggio equipaggiato sull'utente
    const [updatedUser] = await db
      .update(users)
      .set({
        equippedCharacterId: validated.characterId,
      })
      .where(eq(users.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile equipaggiare il personaggio.");
  }
}
