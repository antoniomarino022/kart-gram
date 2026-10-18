import { eq, sql } from "drizzle-orm";
import { coinTransactions, playerItems, telegramUsers } from "@/db/schema";
import { CoinReason } from "@/types/enums";
import type { Tx } from "@/server/tx";
import type { ItemRow } from "./catalog";

export type GrantSource = "coins" | "stars" | "grant" | "admin" | "ads" | "referral";

/** Consegna un oggetto comprato: pacchetti di monete e starter pack danno monete/revive, il resto entra tra i posseduti. */
export async function grantItem(tx: Tx, userId: number, item: ItemRow, source: GrantSource) {
  const coins = item.kind === "coin_pack" || item.kind === "starter_pack" ? (item.coins ?? 0) : 0;
  const revives = item.kind === "starter_pack" ? (item.revives ?? 0) : 0;
  if (coins || revives) {
    await tx
      .update(telegramUsers)
      .set({ coins: sql`${telegramUsers.coins} + ${coins}`, revives: sql`${telegramUsers.revives} + ${revives}` })
      .where(eq(telegramUsers.id, userId));
    if (coins) await tx.insert(coinTransactions).values({ userId, amount: coins, reason: CoinReason.PURCHASE });
  }
  if (item.kind === "coin_pack") return;
  // lo starter pack resta tra i posseduti (si compra una volta sola) insieme agli oggetti che regala
  const ids = item.kind === "starter_pack" ? [item.id, ...(item.grants ?? [])] : [item.id];
  await tx
    .insert(playerItems)
    .values(ids.map((itemId) => ({ userId, itemId, source })))
    .onConflictDoNothing();
}
