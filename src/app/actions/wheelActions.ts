"use server";

import { db } from "@/db";
import { wheels, userItems, telegramUsers, unlockProgress, adViews } from "@/db/schema";
import { EquipWheelInput, equipWheelSchema, BuyWheelInput, buyWheelInputSchema, WheelResponse } from "@/schemas/wheels";
import { TelegramUserResponse } from "@/schemas/telegramUsers";
import { UnlockType, AdPurpose } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq, sql } from "drizzle-orm";

/**
 * Equipaggia / Seleziona un set di ruote per l'utente
 * Verifica che le ruote esistano e che l'utente le possieda (o siano FREE)
 */
export async function equipWheel(data: EquipWheelInput): Promise<TelegramUserResponse> {
  try {
    const validated = equipWheelSchema.parse(data);

    const [wheel] = await db
      .select()
      .from(wheels)
      .where(and(eq(wheels.id, validated.wheelId), eq(wheels.isActive, true)))
      .limit(1);

    if (!wheel) {
      throw new Error("Le ruote selezionate non esistono o non sono attive.");
    }

    if (wheel.unlockType !== UnlockType.FREE) {
      const [owned] = await db
        .select()
        .from(userItems)
        .where(
          and(
            eq(userItems.userId, validated.userId),
            eq(userItems.wheelId, validated.wheelId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new Error("Non puoi equipaggiare ruote che non hai ancora sbloccato.");
      }
    }

    const [updatedUser] = await db
      .update(telegramUsers)
      .set({
        equippedWheelId: validated.wheelId,
      })
      .where(eq(telegramUsers.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile equipaggiare le ruote.");
  }
}

/**
 * Acquista e sblocca un set di ruote utilizzando le monete dell'utente
 */
export async function buyWheelWithCoins(data: BuyWheelInput): Promise<WheelResponse> {
  try {
    const validated = buyWheelInputSchema.parse(data);

    const [wheel] = await db
      .select()
      .from(wheels)
      .where(and(eq(wheels.id, validated.wheelId), eq(wheels.isActive, true)))
      .limit(1);

    if (!wheel) {
      throw new Error("Le ruote selezionate non esistono o non sono attive.");
    }

    if (wheel.unlockType !== UnlockType.COINS) {
      throw new Error("Le ruote non sono disponibili per l'acquisto con monete.");
    }

    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.wheelId, validated.wheelId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già queste ruote.");
    }

    const [user] = await db
      .select({ coins: telegramUsers.coins })
      .from(telegramUsers)
      .where(eq(telegramUsers.id, validated.telegramUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utente non trovato.");
    }

    if (user.coins < wheel.unlockValue) {
      throw new Error("Non hai abbastanza soldi per acquistare le ruote.");
    }

    await db.insert(userItems).values({
      userId: validated.telegramUserId,
      wheelId: validated.wheelId,
      unlockedAt: new Date(),
    });

    await db
      .update(telegramUsers)
      .set({
        coins: user.coins - wheel.unlockValue,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    return wheel;
  } catch (error) {
    handleActionError(error, "Impossibile acquistare le ruote.");
  }
}

/**
 * Registra la visione di un video pubblicitario (ADS) per sbloccare un set di ruote.
 */
export async function watchAdForWheel(data: BuyWheelInput): Promise<{
  wheel: WheelResponse;
  progress: number;
  required: number;
  unlocked: boolean;
}> {
  try {
    const validated = buyWheelInputSchema.parse(data);

    const [wheel] = await db
      .select()
      .from(wheels)
      .where(and(eq(wheels.id, validated.wheelId), eq(wheels.isActive, true)))
      .limit(1);

    if (!wheel) {
      throw new Error("Le ruote selezionate non esistono o non sono attive.");
    }

    if (wheel.unlockType !== UnlockType.ADS) {
      throw new Error("Queste ruote non sono sbloccabili tramite pubblicità.");
    }

    const [user] = await db
      .select({ id: telegramUsers.id })
      .from(telegramUsers)
      .where(eq(telegramUsers.id, validated.telegramUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utente non trovato.");
    }

    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.wheelId, validated.wheelId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già queste ruote.");
    }

    await db.insert(adViews).values({
      userId: validated.telegramUserId,
      purpose: AdPurpose.UNLOCK_ITEM,
      wheelId: validated.wheelId,
    });

    await db
      .update(telegramUsers)
      .set({
        adsWatchedTotal: sql`${telegramUsers.adsWatchedTotal} + 1`,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    const [existingProgress] = await db
      .select()
      .from(unlockProgress)
      .where(
        and(
          eq(unlockProgress.userId, validated.telegramUserId),
          eq(unlockProgress.wheelId, validated.wheelId)
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
        wheelId: validated.wheelId,
        progress: 1,
        updatedAt: new Date(),
      });
    }

    const unlocked = newProgress >= wheel.unlockValue;
    if (unlocked) {
      await db.insert(userItems).values({
        userId: validated.telegramUserId,
        wheelId: validated.wheelId,
        unlockedAt: new Date(),
      });
    }

    return {
      wheel,
      progress: newProgress,
      required: wheel.unlockValue,
      unlocked,
    };
  } catch (error) {
    handleActionError(error, "Impossibile registrare la pubblicità per le ruote.");
  }
}
