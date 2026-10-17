"use server";

import { db } from "@/db";
import { characters, userItems, telegramUsers, unlockProgress, adViews } from "@/db/schema";
import {
  EquipCharacterInput,
  equipCharacterSchema,
  BuyCharacterInput,
  buyCharacterInputSchema,
  CharacterResponse,
} from "@/schemas/characters";
import { TelegramUserResponse } from "@/schemas/telegramUsers";
import { UnlockType, AdPurpose } from "@/types/enums";
import { handleActionError } from "@/utils/errors";
import { and, eq, sql } from "drizzle-orm";


/**
 * Equipaggia / Seleziona un personaggio per l'utente
 * Verifica che il personaggio esista e che l'utente lo possieda (o sia FREE)
 */
export async function equipCharacter(
  data: EquipCharacterInput
): Promise<TelegramUserResponse> {
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
      .update(telegramUsers)
      .set({
        equippedCharacterId: validated.characterId,
      })
      .where(eq(telegramUsers.id, validated.userId))
      .returning();

    if (!updatedUser) {
      throw new Error("Utente non trovato.");
    }

    return updatedUser;
  } catch (error) {
    handleActionError(error, "Impossibile equipaggiare il personaggio.");
  }
}

/**
 * Acquista e sblocca un personaggio utilizzando le monete dell'utente
 */
export async function buyCharacterWithCoins(
  data: BuyCharacterInput
): Promise<CharacterResponse> {
  try {
    const validated = buyCharacterInputSchema.parse(data);

    // 1. Verifica esistenza del personaggio
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

    if (character.unlockType !== UnlockType.COINS) {
      throw new Error("Il personaggio non è disponibile per l'acquisto con monete.");
    }

    // 2. Verifica che l'utente non possieda già il personaggio
    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.characterId, validated.characterId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questo personaggio.");
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

    if (user.coins < character.unlockValue) {
      throw new Error("Non hai abbastanza soldi per acquistare il personaggio.");
    }

    // 4. Inserisci il personaggio nella tabella User_Items
    await db.insert(userItems).values({
      userId: validated.telegramUserId,
      characterId: validated.characterId,
      unlockedAt: new Date(),
    });

    // 5. Aggiorna i soldi dell'utente
    await db
      .update(telegramUsers)
      .set({
        coins: user.coins - character.unlockValue,
      })
      .where(eq(telegramUsers.id, validated.telegramUserId));

    return character;
  } catch (error) {
    handleActionError(error, "Impossibile acquistare il personaggio.");
  }
}

/**
 * Registra la visione di un video pubblicitario (ADS) per sbloccare un personaggio.
 * Quando il progresso raggiunge character.unlockValue, il personaggio viene inserito in User_Items.
 */
export async function watchAdForCharacter(data: BuyCharacterInput): Promise<{
  character: CharacterResponse;
  progress: number;
  required: number;
  unlocked: boolean;
}> {
  try {
    const validated = buyCharacterInputSchema.parse(data);

    // 1. Verifica esistenza del personaggio e tipo di sblocco ADS
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

    if (character.unlockType !== UnlockType.ADS) {
      throw new Error("Questo personaggio non è sbloccabile tramite pubblicità.");
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

    // 3. Verifica che l'utente non possieda già il personaggio
    const [alreadyOwned] = await db
      .select()
      .from(userItems)
      .where(
        and(
          eq(userItems.userId, validated.telegramUserId),
          eq(userItems.characterId, validated.characterId)
        )
      )
      .limit(1);

    if (alreadyOwned) {
      throw new Error("Possiedi già questo personaggio.");
    }

    // 4. Registra la visione dell'annuncio in Ad_Views e incrementa adsWatchedTotal sull'utente
    await db.insert(adViews).values({
      userId: validated.telegramUserId,
      purpose: AdPurpose.UNLOCK_ITEM,
      characterId: validated.characterId,
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
          eq(unlockProgress.characterId, validated.characterId)
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
        characterId: validated.characterId,
        progress: 1,
        updatedAt: new Date(),
      });
    }

    // 6. Se ha raggiunto il numero di video richiesti, sblocca il personaggio in User_Items
    const unlocked = newProgress >= character.unlockValue;
    if (unlocked) {
      await db.insert(userItems).values({
        userId: validated.telegramUserId,
        characterId: validated.characterId,
        unlockedAt: new Date(),
      });
    }

    return {
      character,
      progress: newProgress,
      required: character.unlockValue,
      unlocked,
    };
  } catch (error) {
    handleActionError(error, "Impossibile registrare la pubblicità per il personaggio.");
  }
}
