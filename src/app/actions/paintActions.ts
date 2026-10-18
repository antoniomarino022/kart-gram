"use server";

import { db } from "@/db";
import { paints, userItems, telegramUsers, unlockProgress, adViews } from "@/db/schema";
import { EquipPaintInput, equipPaintSchema, BuyPaintInput, buyPaintInputSchema, PaintResponse } from "@/schemas/paints";
import { TelegramUserResponse } from "@/schemas/telegramUsers";
import { UnlockType, AdPurpose } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq, sql } from "drizzle-orm";

/**
 * Equipaggia / Seleziona una vernice per l'utente
 * Verifica che la vernice esista e che l'utente la possieda (o sia FREE)
 */
export async function equipPaint(data: EquipPaintInput): Promise<TelegramUserResponse> {
  try {
    const validated = equipPaintSchema.parse(data);

    const [paint] = await db
      .select()
      .from(paints)
      .where(and(eq(paints.id, validated.paintId), eq(paints.isActive, true)))
      .limit(1);

    if (!paint) {
      throw new Error("La vernice selezionata non esiste o non è attiva.");
    }

    if (paint.unlockType !== UnlockType.FREE) {
      const [owned] = await db
        .select()
        .from(userItems)
        .where(
          and(
            eq(userItems.userId, validated.userId),
            eq(userItems.paintId, validated.paintId)
          )
        )
        .limit(1);

      if (!owned) {
        throw new Error("Non puoi equipaggiare una vernice che non hai ancora sbloccato.");
      }
    }

    const [updatedUser] = await db
      .update(telegramUsers)
      .set({
        equippedPaintId: validated.paintId,
      })
      .where(eq(telegramUsers.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile equipaggiare la vernice.");
  }
}

/**
 * Acquista e sblocca una vernice utilizzando le monete dell'utente
 */
export async function buyPaintWithCoins(data: BuyPaintInput): Promise<PaintResponse> {
  try {
    const validated = buyPaintInputSchema.parse(data);

    const [paint] = await db
      .select()
      .from(paints)
      .where(and(eq(paints.id, validated.paintId), eq(paints.isActive, true)))
      .limit(1);

    if (!paint) {
      throw new Error("La vernice selezionata non esiste o non è attiva.");
    }

    if (paint.unlockType !== UnlockType.COINS) {
      throw new Error("La vernice non è disponibile per l'acquisto con monete.");
    }

    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.paintId, validated.paintId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questa vernice.");
    }

    const [user] = await db
      .select({ coins: telegramUsers.coins })
      .from(telegramUsers)
      .where(eq(telegramUsers.id, validated.telegramUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utente non trovato.");
    }

    if (user.coins < paint.unlockValue) {
      throw new Error("Non hai abbastanza soldi per acquistare la vernice.");
    }

    await db.insert(userItems).values({
      userId: validated.telegramUserId,
      paintId: validated.paintId,
      unlockedAt: new Date(),
    });

    await db
      .update(telegramUsers)
      .set({
        coins: user.coins - paint.unlockValue,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    return paint;
  } catch (error) {
    handleActionError(error, "Impossibile acquistare la vernice.");
  }
}

/**
 * Registra la visione di un video pubblicitario (ADS) per sbloccare una vernice.
 */
export async function watchAdForPaint(data: BuyPaintInput): Promise<{
  paint: PaintResponse;
  progress: number;
  required: number;
  unlocked: boolean;
}> {
  try {
    const validated = buyPaintInputSchema.parse(data);

    const [paint] = await db
      .select()
      .from(paints)
      .where(and(eq(paints.id, validated.paintId), eq(paints.isActive, true)))
      .limit(1);

    if (!paint) {
      throw new Error("La vernice selezionata non esiste o non è attiva.");
    }

    if (paint.unlockType !== UnlockType.ADS) {
      throw new Error("Questa vernice non è sbloccabile tramite pubblicità.");
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
          eq(userItems.paintId, validated.paintId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questa vernice.");
    }

    await db.insert(adViews).values({
      userId: validated.telegramUserId,
      purpose: AdPurpose.UNLOCK_ITEM,
      paintId: validated.paintId,
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
          eq(unlockProgress.paintId, validated.paintId)
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
        paintId: validated.paintId,
        progress: 1,
        updatedAt: new Date(),
      });
    }

    const unlocked = newProgress >= paint.unlockValue;
    if (unlocked) {
      await db.insert(userItems).values({
        userId: validated.telegramUserId,
        paintId: validated.paintId,
        unlockedAt: new Date(),
      });
    }

    return {
      paint,
      progress: newProgress,
      required: paint.unlockValue,
      unlocked,
    };
  } catch (error) {
    handleActionError(error, "Impossibile registrare la pubblicità per la vernice.");
  }
}
