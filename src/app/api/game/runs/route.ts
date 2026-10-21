import { redis } from '@/lib/redis';
import { randomInt } from "node:crypto";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { runs } from "@/db/schema";
import { CONFIG, TICK_RATE } from "@/game/core/config";
import { requirePlayer } from "@/lib/auth";
import {
  getPlayer,
  loadItems,
  ownedIds,
  resolveEquipped,
  upgradeLevels,
} from "@/lib/game-helpers";
import { handle } from "@/lib/http";

/** Durata massima consentita per una singola partita prima che venga considerata scaduta. */
const RUN_MAX_MS = (CONFIG.maxTicks / TICK_RATE) * 1000 + 10 * 60 * 1000;

/** Numero massimo di partite lasciate aperte contemporaneamente dallo stesso giocatore. */
const MAX_OPEN_RUNS = 3;

/**
 * Chiude come `expired` le partite rimaste aperte troppo a lungo o oltre il limite `MAX_OPEN_RUNS`
 * (evita che un giocatore accumuli decine di seed per inviare solo la partita migliore).
 */
async function expireStaleRuns(userId: number): Promise<void> {
  const staleBefore = new Date(Date.now() - RUN_MAX_MS);

  await db
    .update(runs)
    .set({ status: "expired" })
    .where(
      and(
        eq(runs.userId, userId),
        eq(runs.status, "running"),
        lt(runs.startedAt, staleBefore),
      ),
    );

  const openRuns = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.status, "running")))
    .orderBy(desc(runs.startedAt))
    .offset(MAX_OPEN_RUNS - 1);

  if (openRuns.length > 0) {
    const idsToExpire = openRuns.map((r) => r.id);
    await db
      .update(runs)
      .set({ status: "expired" })
      .where(and(inArray(runs.id, idsToExpire), eq(runs.status, "running")));
  }
}

/**
 * POST /api/game/runs
 *
 * Avvia una nuova partita:
 * - fa scadere eventuali partite vecchie rimaste aperte;
 * - fotografa i livelli `upgrades` e le `wheels` equipaggiate in questo istante;
 * - genera un `seed` casuale crittografico sul server e crea la riga in `Runs`;
 * - restituisce `{ runId, seed, upgrades, wheels }` con cui il client avvierà la simulazione.
 */
export const POST = handle(async (request: Request) => {
  const authPlayer = await requirePlayer(request);

  await expireStaleRuns(authPlayer.id);

  const [player, allItems, upgrades] = await Promise.all([
    getPlayer(authPlayer.id),
    loadItems({ activeOnly: false }),
    upgradeLevels(authPlayer.id),
  ]);

  const owned = await ownedIds(authPlayer.id, allItems);
  const { wheels } = resolveEquipped(player.equipped, owned, allItems);
  const seed = randomInt(0, 2 ** 31 - 1);

  void redis.set('player:' + authPlayer.id + ':active_run', '1', { ex: Math.ceil(RUN_MAX_MS / 1000) }).catch(() => {});
  const [run] = await db
    .insert(runs)
    .values({ userId: authPlayer.id, seed, upgrades, wheels })
    .returning({ id: runs.id });

  return { runId: run.id, seed, upgrades, wheels };
});
