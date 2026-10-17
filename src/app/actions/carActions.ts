"use server";

import { db } from "@/db";
import { cars, userItems, telegramUsers, unlockProgress, adViews } from "@/db/schema";
import { EquipCarInput, equipCarSchema, BuyCarInput, buyCarInputSchema, CarResponse } from "@/schemas/cars";
import { TelegramUserResponse } from "@/schemas/telegramUsers";
import { UnlockType, AdPurpose } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq, sql } from "drizzle-orm";



/**
 * Equipaggia / Seleziona un'auto per l'utente
 * Verifica che l'auto esista e che l'utente la possieda (o sia FREE)
 */
export async function equipCar(data: EquipCarInput): Promise<TelegramUserResponse> {
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
      .update(telegramUsers)
      .set({
        equippedCarId: validated.carId,
      })
      .where(eq(telegramUsers.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile equipaggiare l'auto.");
  }
}


/**
 * Acquista e sblocca un'auto utilizzando le monete dell'utente
 */
export async function buyCarWithCoins(data: BuyCarInput): Promise<CarResponse> {
  try {
    const validated = buyCarInputSchema.parse(data);

    // 1. Verifica esistenza dell'auto
    const [car] = await db
      .select()
      .from(cars)
      .where(and(eq(cars.id, validated.carId), eq(cars.isActive, true)))
      .limit(1);

    if (!car) {
      throw new Error("L'auto selezionata non esiste o non è attiva.");
    }

    if (car.unlockType !== UnlockType.COINS) {
      throw new Error("L'auto non è disponibile per l'acquisto con monete.");
    }

    // 2. Verifica che l'utente non possieda già l'auto
    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.carId, validated.carId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questa auto.");
    }

    // 3. Recupera i soldi dell'utente
    const [user] = await db
      .select({ coins: telegramUsers.coins })
      .from(telegramUsers)
      .where(eq(telegramUsers.id, validated.telegramUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utente non trovato.");
    }

    if (user.coins < car.unlockValue) {
      throw new Error("Non hai abbastanza soldi per acquistare l'auto.");
    }

    // 4. Inserisci l'auto nella tabella User_Items
    await db.insert(userItems).values({
      userId: validated.telegramUserId,
      carId: validated.carId,
      unlockedAt: new Date(),
    });

    // 5. Aggiorna i soldi dell'utente
    await db
      .update(telegramUsers)
      .set({
        coins: user.coins - car.unlockValue,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    return car;
  } catch (error) {
    handleActionError(error, "Impossibile acquistare l'auto.");
  }
}

/**
 * Registra la visione di un video pubblicitario (ADS) per sbloccare un'auto.
 * Quando il progresso raggiunge car.unlockValue, l'auto viene inserita in User_Items.
 */
export async function watchAdForCar(data: BuyCarInput): Promise<{
  car: CarResponse;
  progress: number;
  required: number;
  unlocked: boolean;
}> {
  try {
    const validated = buyCarInputSchema.parse(data);

    // 1. Verifica esistenza dell'auto e tipo di sblocco ADS
    const [car] = await db
      .select()
      .from(cars)
      .where(and(eq(cars.id, validated.carId), eq(cars.isActive, true)))
      .limit(1);

    if (!car) {
      throw new Error("L'auto selezionata non esiste o non è attiva.");
    }

    if (car.unlockType !== UnlockType.ADS) {
      throw new Error("Quest'auto non è sbloccabile tramite pubblicità.");
    }

    // 2. Verifica che l'utente esista
    const [user] = await db
      .select({ id: telegramUsers.id })
      .from(telegramUsers)
      .where(eq(telegramUsers.id, validated.telegramUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utente non trovato.");
    }

    // 3. Verifica che l'utente non possieda già l'auto
    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.carId, validated.carId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questa auto.");
    }

    // 4. Registra la visione dell'annuncio in Ad_Views e incrementa adsWatchedTotal sull'utente
    await db.insert(adViews).values({
      userId: validated.telegramUserId,
      purpose: AdPurpose.UNLOCK_ITEM,
      carId: validated.carId,
    });

    await db
      .update(telegramUsers)
      .set({
        adsWatchedTotal: sql`${telegramUsers.adsWatchedTotal} + 1`,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    // 5. Aggiorna o crea il progresso in Unlock_Progress
    const [existingProgress] = await db
      .select()
      .from(unlockProgress)
      .where(
        and(
          eq(unlockProgress.userId, validated.telegramUserId),
          eq(unlockProgress.carId, validated.carId)
        )
      )
      .limit(1);

    let newProgress = 1;

    if (existingProgress) {
      newProgress = existingProgress.progress + 1;
      await db
        .update(unlockProgress)
        .set({
          progress: newProgress,
          updatedAt: new Date(),
        })
        .where(eq(unlockProgress.id, existingProgress.id));
    } else {
      await db.insert(unlockProgress).values({
        userId: validated.telegramUserId,
        carId: validated.carId,
        progress: 1,
        updatedAt: new Date(),
      });
    }

    // 6. Se ha raggiunto il numero di video richiesti, sblocca l'auto in User_Items
    const unlocked = newProgress >= car.unlockValue;
    if (unlocked) {
      await db.insert(userItems).values({
        userId: validated.telegramUserId,
        carId: validated.carId,
        unlockedAt: new Date(),
      });
    }

    return {
      car,
      progress: newProgress,
      required: car.unlockValue,
      unlocked,
    };
  } catch (error) {
    handleActionError(error, "Impossibile registrare la pubblicità per l'auto.");
  }
}
