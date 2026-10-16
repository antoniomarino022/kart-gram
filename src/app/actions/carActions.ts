"use server";

import { db } from "@/db";
import { cars, userItems, users } from "@/db/schema";
import { EquipCarInput, equipCarSchema } from "@/schemas/cars";
import { UserResponse } from "@/schemas/users";
import { UnlockType } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq } from "drizzle-orm";



/**
 * Equipaggia / Seleziona un'auto per l'utente
 * Verifica che l'auto esista e che l'utente la possieda (o sia FREE)
 */
export async function equipCar(data: EquipCarInput): Promise<UserResponse> {
  try {
    const validated = equipCarSchema.parse(data);

    // Verifica esistenza dell'auto
    const [car] = await db
      .select()
      .from(cars)
      .where(and(eq(cars.id, validated.carId), eq(cars.isActive, true)))
      .limit(1);

    if (!car) {
      throw new Error("L'auto selezionata non esiste o non è attiva.");
    }

    // Se l'auto non è FREE, verifica che l'utente la possieda in User_Items
    if (car.unlockType !== UnlockType.FREE) {
      const [owned] = await db
        .select()
        .from(userItems)
        .where(
          and(
            eq(userItems.userId, validated.userId),
            eq(userItems.carId, validated.carId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new Error("Non puoi equipaggiare un'auto che non hai ancora sbloccato.");
      }
    }

    // Aggiorna l'auto equipaggiata sull'utente
    const [updatedUser] = await db
      .update(users)
      .set({
        equippedCarId: validated.carId,
      })
      .where(eq(users.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile equipaggiare l'auto.");
  }
}
