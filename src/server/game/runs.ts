import { randomInt } from "node:crypto";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { coinTransactions, runs, starPayments, telegramUsers } from "@/db/schema";
import { REVIVE_PRICE } from "@/backend/catalog";
import type { FinishResult, RevivePay } from "@/backend/types";
import { CONFIG, TICK_RATE } from "@/game/core/config";
import { finalScore, simulate, type UpgradeId } from "@/game/core/sim";
import { CoinReason } from "@/types/enums";
import type { FinishRunBody, RunRow } from "@/types/game";
import { bad, HttpError } from "@/server/http";
import { withTx } from "@/server/tx";
import { loadItems } from "./catalog";
import { spendCoins } from "./coins";
import { createInvoice } from "./payments";
import { getPlayer, lockPlayer } from "./player";
import { buildProfile, ownedIds, resolveEquipped, upgradeLevels } from "./profile";
import { qualifyPendingReferral } from "./referrals";

/** Una partita dura al massimo CONFIG.maxTicks: oltre (più margine) è abbandonata e non si può più chiudere. */
const RUN_MAX_MS = (CONFIG.maxTicks / TICK_RATE) * 1000 + 10 * 60 * 1000;

/** Partite aperte insieme: aprirne di più fa scadere le vecchie, così non si tengono decine di seed per chiudere solo il migliore. */
const MAX_OPEN_RUNS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadRun(userId: number, runId: string): Promise<RunRow | undefined> {
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)))
    .limit(1);

  return run;
}

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

  // Le partite lasciate a metà (uscita dalla pausa, app chiusa) restano aperte: oltre il limite scadono le più vecchie
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

// ---------------------------------------------------------------------------
// Inizio partita
// ---------------------------------------------------------------------------

/**
 * Nuova partita: seed del server e stato (upgrade, ruote) fissato ora,
 * così il replay alla fine è lo stesso del client.
 */
export async function startRun(userId: number) {
  await expireStaleRuns(userId);

  const [player, allItems, upgrades] = await Promise.all([
    getPlayer(userId),
    loadItems({ activeOnly: false }),
    upgradeLevels(userId),
  ]);

  const owned = await ownedIds(userId, allItems);
  const { wheels } = resolveEquipped(player.equipped, owned, allItems);
  const seed = randomInt(0, 2 ** 31 - 1);

  const [run] = await db
    .insert(runs)
    .values({ userId, seed, upgrades, wheels })
    .returning({ id: runs.id });

  return { runId: run.id, seed, upgrades, wheels };
}

// ---------------------------------------------------------------------------
// Fine partita
// ---------------------------------------------------------------------------

/**
 * Revive pagato in Stelle: il client riparte appena Telegram dice "paid", ma il webhook che segna la partita
 * come rianimata può arrivare dopo. Si aspetta qualche secondo prima di rigiocare senza revive.
 */
async function waitForStarsRevive(runId: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const [pending] = await db
      .select({ id: starPayments.id })
      .from(starPayments)
      .where(
        and(
          eq(starPayments.runId, runId),
          eq(starPayments.purpose, "revive"),
          eq(starPayments.status, "pending"),
        ),
      )
      .limit(1);

    if (!pending) {
      return;
    }

    const [run] = await db
      .select({ revived: runs.revived })
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);

    if (run?.revived) {
      return;
    }

    await sleep(1000);
  }
}

/**
 * Rigioca la partita e, in transazione, la chiude e accredita monete e record.
 * Restituisce null se la partita non era più chiudibile in quello stato (già chiusa o rianimata nel frattempo).
 */
async function closeRun(userId: number, run: RunRow, { ticks, inputs }: FinishRunBody) {
  const simState = simulate(run.seed, inputs, {
    upgrades: { ...run.upgrades } as Record<UpgradeId, number>,
    wheels: run.wheels,
    revived: run.revived,
    maxTicks: ticks,
  });

  const score = finalScore(simState);
  const coins = simState.coins;
  const distance = Math.floor(simState.kart.s);

  return withTx(async (tx) => {
    // Condizione anche su revived: se nel frattempo il webhook ha registrato un revive, il replay va rifatto
    const closed = await tx
      .update(runs)
      .set({
        status: "finished",
        score,
        coins,
        distance,
        ticks: simState.tick,
        finishedAt: new Date(),
      })
      .where(
        and(
          eq(runs.id, run.id),
          eq(runs.status, "running"),
          eq(runs.revived, run.revived),
        ),
      )
      .returning({ id: runs.id });

    if (closed.length === 0) {
      return null;
    }

    const player = await lockPlayer(tx, userId);
    const newBest = score > player.allTimeHighScore;

    await tx
      .update(telegramUsers)
      .set({
        coins: sql`${telegramUsers.coins} + ${coins}`,
        allTimeHighScore: sql`greatest(${telegramUsers.allTimeHighScore}, ${score})`,
      })
      .where(eq(telegramUsers.id, userId));

    if (coins > 0) {
      await tx
        .insert(coinTransactions)
        .values({ userId, amount: coins, reason: CoinReason.RUN });
    }

    await qualifyPendingReferral(tx, userId);

    return { newBest, coinsEarned: coins };
  });
}

/**
 * Fine partita: il punteggio e le monete NON arrivano dal client. Il server rigioca seed + input
 * con la stessa simulazione deterministica del gioco e usa il risultato.
 * Il replay gira fuori dalla transazione; la chiusura è un UPDATE condizionato (una partita si chiude una volta sola).
 */
export async function finishRun(
  userId: number,
  runId: string,
  body: FinishRunBody,
): Promise<FinishResult> {
  let run = await loadRun(userId, runId);
  if (!run) {
    throw new HttpError(404, "Partita non trovata");
  }

  const isExpired = Date.now() - run.startedAt.getTime() > RUN_MAX_MS;
  if (run.status !== "running" || isExpired) {
    throw new HttpError(409, "Partita già chiusa");
  }

  if (body.revived && !run.revived) {
    await waitForStarsRevive(run.id);
    run = (await loadRun(userId, runId)) ?? run;
  }

  // Non si può aver giocato più tick del tempo reale trascorso (margine per pause di rete)
  const elapsedSeconds = (Date.now() - run.startedAt.getTime()) / 1000;
  if (body.ticks / TICK_RATE > elapsedSeconds * 1.1 + 10) {
    throw bad("Durata della partita non valida");
  }

  let result = await closeRun(userId, run, body);
  if (!result) {
    const freshRun = await loadRun(userId, runId);
    if (freshRun?.status === "running") {
      result = await closeRun(userId, freshRun, body);
    }
  }

  if (!result) {
    throw new HttpError(409, "Partita già chiusa");
  }

  const profile = await buildProfile(userId);
  return { ...result, profile };
}

// ---------------------------------------------------------------------------
// Revive
// ---------------------------------------------------------------------------

export async function revive(
  userId: number,
  runId: string,
  pay: RevivePay,
): Promise<{ ok: boolean; invoiceLink?: string }> {
  if (pay === "stars") {
    const run = await loadRun(userId, runId);
    if (!run || run.status !== "running" || run.revived) {
      throw bad("Revive non disponibile");
    }

    const invoiceLink = await createInvoice(userId, {
      purpose: "revive",
      runId,
      stars: REVIVE_PRICE.stars,
      title: "Revive",
      description: "Riparti dal punto in cui sei caduto",
    });

    return { ok: true, invoiceLink };
  }

  return withTx(async (tx) => {
    const [run] = await tx
      .select()
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.userId, userId)))
      .for("update");

    if (!run || run.status !== "running" || run.revived) {
      throw bad("Revive non disponibile");
    }

    const player = await lockPlayer(tx, userId);

    if (pay === "coins") {
      if (player.coins < REVIVE_PRICE.coins) {
        return { ok: false };
      }
      await spendCoins(tx, userId, player.coins, REVIVE_PRICE.coins, CoinReason.REVIVE);
    } else {
      if (player.revives <= 0) {
        return { ok: false };
      }
      await tx
        .update(telegramUsers)
        .set({ revives: sql`${telegramUsers.revives} - 1` })
        .where(eq(telegramUsers.id, userId));
    }

    await tx
      .update(runs)
      .set({ revived: true })
      .where(eq(runs.id, run.id));

    return { ok: true };
  });
}
