"use server";

import { db } from "@/db";
import { maps, userItems, telegramUsers, unlockProgress, adViews } from "@/db/schema";
import {
  EquipMapInput,
  equipMapSchema,
  BuyMapInput,
  buyMapInputSchema,
  MapResponse,
} from "@/schemas/maps";
import { TelegramUserResponse } from "@/schemas/telegramUsers";
import { UnlockType, AdPurpose } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq, sql } from "drizzle-orm";

/**
 * Equipaggia / Seleziona una mappa per l'utente
 * Verifica che la mappa esista e che l'utente la possieda (o sia FREE)
 */
export async function equipMap(data: EquipMapInput): Promise<TelegramUserResponse> {
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
      .update(telegramUsers)
      .set({
        equippedMapId: validated.mapId,
      })
      .where(eq(telegramUsers.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile selezionare la mappa.");
  }
}

/**
 * Acquista e sblocca una mappa utilizzando le monete dell'utente
 */
export async function buyMapWithCoins(data: BuyMapInput): Promise<MapResponse> {
  try {
    const validated = buyMapInputSchema.parse(data);

    // 1. Verifica esistenza della mappa
    const [map] = await db
      .select()
      .from(maps)
      .where(and(eq(maps.id, validated.mapId), eq(maps.isActive, true)))
      .limit(1);

    if (!map) {
      throw new Error("La mappa selezionata non esiste o non è attiva.");
    }

    if (map.unlockType !== UnlockType.COINS) {
      throw new Error("La mappa non è disponibile per l'acquisto con monete.");
    }

    // 2. Verifica che l'utente non possieda già la mappa
    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.mapId, validated.mapId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questa mappa.");
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

    if (user.coins < map.unlockValue) {
      throw new Error("Non hai abbastanza soldi per acquistare la mappa.");
    }

    // 4. Inserisci la mappa nella tabella User_Items
    await db.insert(userItems).values({
      userId: validated.telegramUserId,
      mapId: validated.mapId,
      unlockedAt: new Date(),
    });

    // 5. Aggiorna i soldi dell'utente
    await db
      .update(telegramUsers)
      .set({
        coins: user.coins - map.unlockValue,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    return map;
  } catch (error) {
    handleActionError(error, "Impossibile acquistare la mappa.");
  }
}

/**
 * Registra la visione di un video pubblicitario (ADS) per sbloccare una mappa.
 * Quando il progresso raggiunge map.unlockValue, la mappa viene inserita in User_Items.
 */
export async function watchAdForMap(data: BuyMapInput): Promise<{
  map: MapResponse;
  progress: number;
  required: number;
  unlocked: boolean;
}> {
  try {
    const validated = buyMapInputSchema.parse(data);

    // 1. Verifica esistenza della mappa e tipo di sblocco ADS
    const [map] = await db
      .select()
      .from(maps)
      .where(and(eq(maps.id, validated.mapId), eq(maps.isActive, true)))
      .limit(1);

    if (!map) {
      throw new Error("La mappa selezionata non esiste o non è attiva.");
    }

    if (map.unlockType !== UnlockType.ADS) {
      throw new Error("Questa mappa non è sbloccabile tramite pubblicità.");
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

    // 3. Verifica che l'utente non possieda già la mappa
    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.mapId, validated.mapId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questa mappa.");
    }

    // 4. Registra la visione dell'annuncio in Ad_Views e incrementa adsWatchedTotal sull'utente
    await db.insert(adViews).values({
      userId: validated.telegramUserId,
      purpose: AdPurpose.UNLOCK_ITEM,
      mapId: validated.mapId,
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
          eq(unlockProgress.mapId, validated.mapId)
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
        mapId: validated.mapId,
        progress: 1,
        updatedAt: new Date(),
      });
    }

    // 6. Se ha raggiunto il numero di video richiesti, sblocca la mappa in User_Items
    const unlocked = newProgress >= map.unlockValue;
    if (unlocked) {
      await db.insert(userItems).values({
        userId: validated.telegramUserId,
        mapId: validated.mapId,
        unlockedAt: new Date(),
      });
    }

    return {
      map,
      progress: newProgress,
      required: map.unlockValue,
      unlocked,
    };
  } catch (error) {
    handleActionError(error, "Impossibile registrare la pubblicità per la mappa.");
  }
}
