import { and, eq, sql } from "drizzle-orm";
import { db, withTx, type Tx } from "@/db";
import { coinTransactions, referrals, runs, starPayments, telegramUsers } from "@/db/schema";
import { CONFIG, TICK_RATE } from "@/game/core/config";
import { finalScore, simulate, type UpgradeId } from "@/game/core/sim";
import { requirePlayer } from "@/lib/auth";
import { addCoins, buildProfile, lockPlayer } from "@/lib/game-helpers";
import { bad, handle, HttpError } from "@/lib/http";
import { finishRunBodySchema } from "@/schemas/game";
import { CoinReason, ReferralStatus } from "@/types/enums";
import type { FinishRunBody, IdParamContext, RunRow } from "@/types/game";
import { parseRunId } from "../params";

const RUN_MAX_MS = (CONFIG.maxTicks / TICK_RATE) * 1000 + 10 * 60 * 1000;
const REFERRAL_REWARD_COINS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadRun(userId: number, runId: string): Promise<RunRow | undefined> {
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.userId, userId)))
    .limit(1);

  return run;
}

/**
 * Se il giocatore ha pagato un revive con Telegram Stars, il client riprende subito la corsa,
 * ma il webhook `successful_payment` potrebbe arrivare qualche istante dopo.
 * Attende fino a 8 secondi se esiste un pagamento `pending` per questa partita.
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
 * Se il giocatore era stato invitato tramite link referral e questa è la sua prima partita conclusa,
 * qualifica il referral (`QUALIFIED`) e accredita il bonus monete all'invitante.
 */
async function qualifyPendingReferral(tx: Tx, invitedUserId: number): Promise<void> {
  const [pending] = await tx
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.invitedUserId, invitedUserId),
        eq(referrals.status, ReferralStatus.PENDING),
      ),
    )
    .limit(1);

  if (!pending) {
    return;
  }

  await tx
    .update(referrals)
    .set({
      status: ReferralStatus.QUALIFIED,
      qualifiedAt: new Date(),
    })
    .where(eq(referrals.id, pending.id));

  await addCoins(tx, pending.inviterUserId, REFERRAL_REWARD_COINS, CoinReason.REFERRAL);
}

/**
 * Rigioca sul server la partita con la simulazione deterministica (`simulate`) usando `seed` e `inputs`
 * e salva in transazione punteggio, monete, eventuale nuovo record e bonus referral.
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
 * POST /api/game/runs/:id/finish
 *
 * Conclude una partita in corso e valida il risultato con anti-cheat server-side:
 * - Il server NON si fida di `score` o `coins` inviati dal client;
 * - Verifica che la durata in `ticks` sia compatibile col tempo reale trascorso da `startedAt`;
 * - Rigioca l'intera sequenza di `inputs` sul `seed` generato all'avvio;
 * - Accredita le monete effettivamente raccolte nella simulazione e aggiorna `allTimeHighScore`;
 * - Restituisce `{ newBest, coinsEarned, profile }`.
 */
export const POST = handle(async (request: Request, context: IdParamContext) => {
  const player = await requirePlayer(request);
  const runId = await parseRunId(context);
  const body = finishRunBodySchema.parse(await request.json());

  let run = await loadRun(player.id, runId);
  if (!run) {
    throw new HttpError(404, "Partita non trovata");
  }

  const isExpired = Date.now() - run.startedAt.getTime() > RUN_MAX_MS;
  if (run.status !== "running" || isExpired) {
    throw new HttpError(409, "Partita già chiusa");
  }

  if (body.revived && !run.revived) {
    await waitForStarsRevive(run.id);
    run = (await loadRun(player.id, runId)) ?? run;
  }

  // Controllo anti-speedhack: i tick giocati non possono superare il tempo reale trascorso
  const elapsedSeconds = (Date.now() - run.startedAt.getTime()) / 1000;
  if (body.ticks / TICK_RATE > elapsedSeconds * 1.1 + 10) {
    throw bad("Durata della partita non valida");
  }

  let result = await closeRun(player.id, run, body);
  if (!result) {
    const freshRun = await loadRun(player.id, runId);
    if (freshRun?.status === "running") {
      result = await closeRun(player.id, freshRun, body);
    }
  }

  if (!result) {
    throw new HttpError(409, "Partita già chiusa");
  }

  const profile = await buildProfile(player.id);
  return { ...result, profile };
});
