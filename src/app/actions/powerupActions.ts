"use server";

import { db } from "@/db";
import { powerups, userPowerups, telegramUsers } from "@/db/schema";
import { BuyPowerupInput, buyPowerupInputSchema, PowerupResponse } from "@/schemas/powerups";
import { UserPowerupResponse } from "@/schemas/items";
import { UnlockType } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq } from "drizzle-orm";

const MAX_POWERUP_LEVEL = 5;

/**
 * Acquista o potenzia (upgrade livello 1 -> 5) un powerup utilizzando le monete dell'utente
 * nella tabella many-to-many User_Powerups.
 */
export async function buyOrUpgradePowerupWithCoins(data: BuyPowerupInput): Promise<{
  powerup: PowerupResponse;
  userPowerup: UserPowerupResponse;
}> {
  try {
    const validated = buyPowerupInputSchema.parse(data);

    const [powerup] = await db
      .select()
      .from(powerups)
      .where(and(eq(powerups.id, validated.powerupId), eq(powerups.isActive, true)))
      .limit(1);

    if (!powerup) {
      throw new Error("Il powerup selezionato non esiste o non è attivo.");
    }

    if (powerup.unlockType !== UnlockType.COINS && powerup.unlockType !== UnlockType.FREE) {
      throw new Error("Il powerup non è disponibile per l'acquisto con monete.");
    }

    const [user] = await db
      .select({ coins: telegramUsers.coins })
      .from(telegramUsers)
      .where(eq(telegramUsers.id, validated.telegramUserId))
      .limit(1);

    if (!user) {
      throw new Error("Utente non trovato.");
    }

    const [existingUserPowerup] = await db
      .select()
      .from(userPowerups)
      .where(
        and(
          eq(userPowerups.userId, validated.telegramUserId),
          eq(userPowerups.powerupId, validated.powerupId)
        )
      )
      .limit(1);

    if (existingUserPowerup && existingUserPowerup.level >= MAX_POWERUP_LEVEL) {
      throw new Error("Questo powerup ha già raggiunto il livello massimo.");
    }

    const cost = powerup.unlockValue;
    if (user.coins < cost) {
      throw new Error("Non hai abbastanza monete per acquistare o potenziare questo powerup.");
    }

    let updatedUserPowerup: UserPowerupResponse;

    if (existingUserPowerup) {
      const [upgraded] = await db
        .update(userPowerups)
        .set({
          level: existingUserPowerup.level + 1,
          updatedAt: new Date(),
        })
        .where(eq(userPowerups.id, existingUserPowerup.id))
        .returning();
      updatedUserPowerup = upgraded;
    } else {
      const [inserted] = await db
        .insert(userPowerups)
        .values({
          userId: validated.telegramUserId,
          powerupId: validated.powerupId,
          level: 1,
          unlockedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      updatedUserPowerup = inserted;
    }

    if (cost > 0) {
      await db
        .update(telegramUsers)
        .set({
          coins: user.coins - cost,
        })
        .where(eq(telegramUsers.id, validated.telegramUserId));
    }

    return {
      powerup,
      userPowerup: updatedUserPowerup,
    };
  } catch (error) {
    handleActionError(error, "Impossibile acquistare o potenziare il powerup.");
  }
}
