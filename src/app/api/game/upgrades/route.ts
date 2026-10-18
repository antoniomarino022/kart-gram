import { and, eq, max } from "drizzle-orm";
import { withTx } from "@/db";
import { playerUpgrades } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { MAX_UPGRADE_LEVEL, UPGRADE_COSTS } from "@/lib/constants";
import { buildProfile, lockPlayer, spendCoins } from "@/lib/game-helpers";
import { bad, handle } from "@/lib/http";
import { buyUpgradeBodySchema } from "@/schemas/game";
import { CoinReason } from "@/types/enums";

/**
 * POST /api/game/upgrades
 *
 * Acquista il livello successivo (da 1 fino a MAX_UPGRADE_LEVEL = 5) di un potenziamento:
 * `turbo`, `magnet`, `slowmo` oppure `x2`.
 * Body: `{ upgradeId: "turbo" | "magnet" | "slowmo" | "x2" }`
 *
 * Il costo dipende dal livello attuale (`UPGRADE_COSTS = [200, 500, 1000, 2000, 4000]`).
 * In transazione:
 * - blocca la riga del giocatore (`SELECT ... FOR UPDATE`);
 * - verifica che il potenziamento non sia già al livello massimo (5);
 * - scala le monete e registra il nuovo livello in `Player_Upgrades`;
 * - restituisce il `Profile` aggiornato.
 */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { upgradeId } = buyUpgradeBodySchema.parse(await request.json());

  await withTx(async (tx) => {
    const locked = await lockPlayer(tx, player.id);

    // Recupera il livello più alto attualmente raggiunto per questo potenziamento
    const [row] = await tx
      .select({ level: max(playerUpgrades.level) })
      .from(playerUpgrades)
      .where(
        and(
          eq(playerUpgrades.userId, player.id),
          eq(playerUpgrades.upgradeId, upgradeId),
        ),
      );

    const currentLevel = row?.level ?? 0;
    if (currentLevel >= MAX_UPGRADE_LEVEL) {
      throw bad("Potenziamento già al livello massimo");
    }

    const nextLevel = currentLevel + 1;
    const cost = UPGRADE_COSTS[currentLevel];

    // Scala le monete e salva l'acquisto del nuovo livello
    await spendCoins(tx, player.id, locked.coins, cost, CoinReason.PURCHASE);

    await tx
      .insert(playerUpgrades)
      .values({ userId: player.id, upgradeId, level: nextLevel, cost });
  });

  return buildProfile(player.id);
});
