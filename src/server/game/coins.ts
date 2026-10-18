import { eq, sql } from "drizzle-orm";
import { coinTransactions, telegramUsers } from "@/db/schema";
import { CoinReason } from "@/types/enums";
import { bad } from "@/server/http";
import type { Tx } from "@/server/tx";

/**
 * Scala le monete al giocatore (bloccato in transazione) e registra il movimento.
 */
export async function spendCoins(
  tx: Tx,
  userId: number,
  currentCoins: number,
  cost: number,
  reason: CoinReason,
): Promise<void> {
  if (currentCoins < cost) {
    throw bad("Monete insufficienti");
  }

  if (cost <= 0) {
    return;
  }

  await tx
    .update(telegramUsers)
    .set({ coins: sql`${telegramUsers.coins} - ${cost}` })
    .where(eq(telegramUsers.id, userId));

  await tx
    .insert(coinTransactions)
    .values({ userId, amount: -cost, reason });
}

/**
 * Accredita monete (e opzionalmente revive) al giocatore e registra il movimento.
 */
export async function addCoins(
  tx: Tx,
  userId: number,
  coins: number,
  reason: CoinReason,
  revives = 0,
): Promise<void> {
  if (coins <= 0 && revives <= 0) {
    return;
  }

  await tx
    .update(telegramUsers)
    .set({
      coins: sql`${telegramUsers.coins} + ${coins}`,
      revives: sql`${telegramUsers.revives} + ${revives}`,
    })
    .where(eq(telegramUsers.id, userId));

  if (coins > 0) {
    await tx
      .insert(coinTransactions)
      .values({ userId, amount: coins, reason });
  }
}
