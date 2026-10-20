import { and, eq } from "drizzle-orm";
import { withTx } from "@/db";
import { playerUpgrades } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { lockPlayer } from "@/lib/game-helpers";
import { handle } from "@/lib/http";
import { updatePlayerUpgradesSchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";
import { loadPlayerDetail, parsePlayerId } from "../params";

/**
 * PUT /api/admin/players/:id/upgrades
 *
 * Imposta direttamente i livelli dei potenziamenti per il giocatore specificato (0 a 5).
 * Body: `{ upgrades: Record<string, number> }`
 * Per ogni potenziamento:
 * - Se livello 0: rimuove tutti i record da Player_Upgrades per quell'upgradeId
 * - Se livello > 0: allinea i record della tabella Player_Upgrades da 1 fino a livello
 * Restituisce il dettaglio giocatore aggiornato.
 */
export const PUT = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);

  const playerId = await parsePlayerId(context);
  const { upgrades } = updatePlayerUpgradesSchema.parse(await request.json());

  await withTx(async (tx) => {
    await lockPlayer(tx, playerId);

    for (const [upgradeId, targetLevel] of Object.entries(upgrades)) {
      // Rimuove eventuali record precedenti per questo upgradeId
      await tx
        .delete(playerUpgrades)
        .where(
          and(
            eq(playerUpgrades.userId, playerId),
            eq(playerUpgrades.upgradeId, upgradeId),
          ),
        );

      // Se targetLevel > 0, inserisce tutti i livelli da 1 a targetLevel
      for (let lvl = 1; lvl <= targetLevel; lvl++) {
        await tx.insert(playerUpgrades).values({
          userId: playerId,
          upgradeId,
          level: lvl,
          cost: 0,
        });
      }
    }
  });

  return loadPlayerDetail(playerId);
});
