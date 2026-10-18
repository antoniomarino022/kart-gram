import { playerItems } from "@/db/schema";
import { CoinReason } from "@/types/enums";
import type { GrantSource, ItemRow } from "@/types/game";
import type { Tx } from "@/server/tx";
import { addCoins } from "./coins";

/**
 * Consegna un oggetto comprato: pacchetti di monete e starter pack danno monete/revive,
 * il resto entra tra i posseduti.
 */
export async function grantItem(
  tx: Tx,
  userId: number,
  item: ItemRow,
  source: GrantSource,
): Promise<void> {
  const isPack = item.kind === "coin_pack" || item.kind === "starter_pack";
  const coins = isPack ? (item.coins ?? 0) : 0;
  const revives = item.kind === "starter_pack" ? (item.revives ?? 0) : 0;

  await addCoins(tx, userId, coins, CoinReason.PURCHASE, revives);

  if (item.kind === "coin_pack") {
    return;
  }

  // Lo starter pack resta tra i posseduti (si compra una volta sola) insieme agli oggetti che regala
  const itemIds = item.kind === "starter_pack"
    ? [item.id, ...(item.grants ?? [])]
    : [item.id];

  await tx
    .insert(playerItems)
    .values(itemIds.map((itemId) => ({ userId, itemId, source })))
    .onConflictDoNothing();
}
