import { withTx } from "@/db";
import { requirePlayer } from "@/lib/auth";
import {
  activeItem,
  buildProfile,
  grantItem,
  lockPlayer,
  owns,
  spendCoins,
} from "@/lib/game-helpers";
import { bad, handle } from "@/lib/http";
import { buyItemBodySchema } from "@/schemas/game";
import { CoinReason } from "@/types/enums";

/**
 * POST /api/game/shop/coins
 *
 * Acquista un oggetto del catalogo pagando con le monete di gioco.
 * Body: `{ itemId: string }`
 *
 * In una singola transazione atomica (`SELECT ... FOR UPDATE` sul giocatore):
 * - controlla che l'oggetto sia attivo e acquistabile in monete (`priceCoins !== null`);
 * - controlla che il giocatore non lo possieda già;
 * - scala le monete e registra la transazione in `Coin_Transactions`;
 * - inserisce l'oggetto in `Player_Items` e restituisce il `Profile` aggiornato.
 */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { itemId } = buyItemBodySchema.parse(await request.json());

  await withTx(async (tx) => {
    // Verifica che l'oggetto sia attivo e abbia un prezzo in monete
    const item = await activeItem(tx, itemId);
    if (item.priceCoins === null) {
      throw bad("Oggetto non acquistabile con le monete");
    }

    // Blocca la riga del giocatore per evitare doppi acquisti concorrenti
    const locked = await lockPlayer(tx, player.id);

    if (item.kind !== "coin_pack" && (await owns(tx, player.id, item))) {
      throw bad("Oggetto già posseduto");
    }

    // Scala le monete e consegna l'oggetto
    await spendCoins(tx, player.id, locked.coins, item.priceCoins, CoinReason.PURCHASE);
    await grantItem(tx, player.id, item, "coins");
  });

  return buildProfile(player.id);
});
