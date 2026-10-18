import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  coinTransactions,
  items,
  playerItems,
  runs,
  starPayments,
} from "@/db/schema";
import { getPlayer, playerName, upgradeLevels } from "@/lib/game-helpers";
import { HttpError } from "@/lib/http";
import type { IdParamContext } from "@/types/game";

/**
 * Estrae e valida l'ID numerico `:id` del giocatore dai parametri della rotta (`/api/admin/players/[id]/*`).
 * Lancia 404 se il parametro non è un intero positivo valido.
 */
export async function parsePlayerId(context: IdParamContext): Promise<number> {
  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new HttpError(404, "Giocatore non trovato");
  }

  return numericId;
}

/**
 * Carica il dossier completo di un giocatore per la Dashboard Admin:
 * - anagrafica, saldo monete, record, revive, stato ban ed equipaggiamento;
 * - oggetti acquistati o assegnati (`owned`);
 * - livelli potenziamenti (`upgrades`);
 * - ultime 20 partite (`runs`), ultimi 20 pagamenti Stars (`payments`) e ultimi 30 movimenti monete (`transactions`).
 */
export async function loadPlayerDetail(id: number) {
  const player = await getPlayer(id);

  const [owned, upgrades, recentRuns, payments, transactions] = await Promise.all([
    db
      .select({
        itemId: playerItems.itemId,
        name: items.name,
        kind: items.kind,
        source: playerItems.source,
        acquiredAt: playerItems.acquiredAt,
      })
      .from(playerItems)
      .innerJoin(items, eq(items.id, playerItems.itemId))
      .where(eq(playerItems.userId, id))
      .orderBy(desc(playerItems.acquiredAt)),
    upgradeLevels(id),
    db
      .select({
        id: runs.id,
        status: runs.status,
        score: runs.score,
        coins: runs.coins,
        distance: runs.distance,
        revived: runs.revived,
        startedAt: runs.startedAt,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .where(eq(runs.userId, id))
      .orderBy(desc(runs.startedAt))
      .limit(20),
    db
      .select()
      .from(starPayments)
      .where(eq(starPayments.userId, id))
      .orderBy(desc(starPayments.createdAt))
      .limit(20),
    db
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, id))
      .orderBy(desc(coinTransactions.createdAt))
      .limit(30),
  ]);

  return {
    player: {
      id: player.id,
      telegramId: player.telegramId,
      name: playerName(player),
      displayName: player.displayName,
      username: player.username,
      profileIcon: player.profileIcon,
      coins: player.coins,
      bestScore: player.allTimeHighScore,
      revives: player.revives,
      isBanned: player.isBanned,
      equipped: player.equipped,
      createdAt: player.createdAt,
    },
    owned,
    upgrades,
    runs: recentRuns,
    payments,
    transactions,
  };
}
