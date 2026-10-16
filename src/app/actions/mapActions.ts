"use server";

import { db } from "@/db";
import { maps, userItems, users } from "@/db/schema";
import { EquipMapInput, equipMapSchema } from "@/schemas/maps";
import { UserResponse } from "@/schemas/users";
import { UnlockType } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq } from "drizzle-orm";

/**
 * Equipaggia / Seleziona una mappa per l'utente
 * Verifica che la mappa esista e che l'utente la possieda (o sia FREE)
 */
export async function equipMap(data: EquipMapInput): Promise<UserResponse> {
  try {
    const validated = equipMapSchema.parse(data);

    // Verifica esistenza della mappa
    const [map] = await db
      .select()
      .from(maps)
      .where(and(eq(maps.id, validated.mapId), eq(maps.isActive, true)))
      .limit(1);

    if (!map) {
      throw new Error("La mappa selezionata non esiste o non è attiva.");
    }

    // Se la mappa non è FREE, verifica che l'utente la possieda in User_Items
    if (map.unlockType !== UnlockType.FREE) {
      const [owned] = await db
        .select()
        .from(userItems)
        .where(
          and(
            eq(userItems.userId, validated.userId),
            eq(userItems.mapId, validated.mapId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new Error(
          "Non puoi selezionare una mappa che non hai ancora sbloccato."
        );
      }
    }

    // Aggiorna la mappa selezionata sull'utente
    const [updatedUser] = await db
      .update(users)
      .set({
        equippedMapId: validated.mapId,
      })
      .where(eq(users.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile selezionare la mappa.");
  }
}
