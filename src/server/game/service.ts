import { randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, lt, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adViews, coinTransactions, items, playerItems, playerUpgrades, referrals, runs, starPayments, telegramUsers, unlockProgress } from "@/db/schema";
import { AdPurpose, CoinReason, ReferralStatus } from "@/types/enums";
import { MAX_UPGRADE_LEVEL, REVIVE_PRICE, UPGRADE_COSTS } from "@/backend/catalog";
import type { FinishResult, LeaderboardEntry, Profile, RevivePay, Slot } from "@/backend/types";
import { CONFIG, TICK_RATE } from "@/game/core/config";
import { finalScore, simulate, type UpgradeId } from "@/game/core/sim";
import { bad, HttpError } from "@/server/http";
import { withTx, type Tx } from "@/server/tx";
import { isFree, loadItems, type ItemRow } from "./catalog";
import { grantItem } from "./grant";
import { buildProfile, ownedIds, resolveEquipped, upgradeLevels } from "./profile";
import { playerName } from "./player";

const UPGRADE_IDS: UpgradeId[] = ["turbo", "magnet", "slowmo", "x2"];
const SLOTS: Slot[] = ["kart", "paint", "wheels", "trail"];

async function lockPlayer(tx: Tx, userId: number) {
  const [p] = await tx.select().from(telegramUsers).where(eq(telegramUsers.id, userId)).for("update");
  if (!p) throw new HttpError(404, "Giocatore non trovato");
  return p;
}

async function activeItem(q: Tx | typeof db, itemId: string): Promise<ItemRow> {
  const [item] = await q.select().from(items).where(and(eq(items.id, itemId), eq(items.isActive, true))).limit(1);
  if (!item) throw bad("Oggetto sconosciuto");
  return item;
}

async function owns(tx: Tx, userId: number, item: ItemRow) {
  if (isFree(item)) return true;
  const [row] = await tx.select().from(playerItems).where(and(eq(playerItems.userId, userId), eq(playerItems.itemId, item.id))).limit(1);
  return !!row;
}

// ---------------------------------------------------------------------------
// Partite
// ---------------------------------------------------------------------------

/** Nuova partita: seed del server e stato (upgrade, ruote) fissato ora, così il replay alla fine è lo stesso del client. */
/** Una partita dura al massimo CONFIG.maxTicks: oltre (più margine) è abbandonata e non si può più chiudere. */
const RUN_MAX_MS = (CONFIG.maxTicks / TICK_RATE) * 1000 + 10 * 60 * 1000;
/** Partite aperte insieme: aprirne di più fa scadere le vecchie, così non si tengono decine di seed per chiudere solo il migliore. */
const MAX_OPEN_RUNS = 3;

export async function startRun(userId: number) {
  const staleBefore = new Date(Date.now() - RUN_MAX_MS);
  await db.update(runs).set({ status: "expired" }).where(and(eq(runs.userId, userId), eq(runs.status, "running"), lt(runs.startedAt, staleBefore)));
  // le partite lasciate a metà (uscita dalla pausa, app chiusa) restano aperte: oltre il limite scadono le più vecchie
  const open = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.userId, userId), eq(runs.status, "running")))
    .orderBy(desc(runs.startedAt))
    .offset(MAX_OPEN_RUNS - 1);
  if (open.length) await db.update(runs).set({ status: "expired" }).where(and(inArray(runs.id, open.map((r) => r.id)), eq(runs.status, "running")));
  const [player, all, upgrades] = await Promise.all([
    db.select().from(telegramUsers).where(eq(telegramUsers.id, userId)).then((r) => r[0]),
    loadItems({ activeOnly: false }),
    upgradeLevels(userId),
  ]);
  const owned = await ownedIds(userId, all);
  const wheels = resolveEquipped(player.equipped, owned, all).wheels;
  const seed = randomInt(0, 2 ** 31 - 1);
  const [run] = await db.insert(runs).values({ userId, seed, upgrades, wheels }).returning({ id: runs.id });
  return { runId: run.id, seed, upgrades, wheels };
}

const finishSchema = z.object({
  // oltre la durata massima di una partita si rigioca solo fino a lì (il client non ha un tetto)
  ticks: z.number().int().min(0).transform((t) => Math.min(t, CONFIG.maxTicks)),
  revived: z.boolean().optional(),
  inputs: z.array(z.tuple([z.number().int().min(0), z.union([z.literal(-1), z.literal(0), z.literal(1)])])).max(50_000),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Revive pagato in Stelle: il client riparte appena Telegram dice "paid", ma il webhook che segna la partita
 * come rianimata può arrivare dopo. Si aspetta qualche secondo prima di rigiocare senza revive.
 */
async function waitForStarsRevive(runId: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const [pending] = await db
      .select({ id: starPayments.id })
      .from(starPayments)
      .where(and(eq(starPayments.runId, runId), eq(starPayments.purpose, "revive"), eq(starPayments.status, "pending")))
      .limit(1);
    if (!pending) return;
    const [run] = await db.select({ revived: runs.revived }).from(runs).where(eq(runs.id, runId)).limit(1);
    if (run?.revived) return;
    await sleep(1000);
  }
}

/**
 * Fine partita: il punteggio e le monete NON arrivano dal client. Il server rigioca seed + input
 * con la stessa simulazione deterministica del gioco e usa il risultato.
 * Il replay gira fuori dalla transazione; la chiusura è un UPDATE condizionato (una partita si chiude una volta sola).
 */
export async function finishRun(userId: number, runId: string, body: unknown): Promise<FinishResult> {
  const { ticks, inputs, revived } = finishSchema.parse(body);
  const load = async () => (await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, userId))).limit(1))[0];
  let run = await load();
  if (!run) throw new HttpError(404, "Partita non trovata");
  if (run.status !== "running" || Date.now() - run.startedAt.getTime() > RUN_MAX_MS) throw new HttpError(409, "Partita già chiusa");
  if (revived && !run.revived) {
    await waitForStarsRevive(run.id);
    run = await load();
  }

  // non si può aver giocato più tick del tempo reale trascorso (margine per pause di rete)
  const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;
  if (ticks / TICK_RATE > elapsed * 1.1 + 10) throw bad("Durata della partita non valida");

  const close = (r: typeof run) => {
    const st = simulate(r.seed, inputs, {
      upgrades: { ...r.upgrades } as Record<UpgradeId, number>,
      wheels: r.wheels,
      revived: r.revived,
      maxTicks: ticks,
    });
    const score = finalScore(st);
    const coins = st.coins;
    return withTx(async (tx) => {
      // condizione anche su revived: se nel frattempo il webhook ha registrato un revive, il replay va rifatto
      const closed = await tx
        .update(runs)
        .set({ status: "finished", score, coins, distance: Math.floor(st.kart.s), ticks: st.tick, finishedAt: new Date() })
        .where(and(eq(runs.id, r.id), eq(runs.status, "running"), eq(runs.revived, r.revived)))
        .returning({ id: runs.id });
      if (!closed.length) return null;
      const player = await lockPlayer(tx, userId);
      const newBest = score > player.allTimeHighScore;
      await tx
        .update(telegramUsers)
        .set({ coins: sql`${telegramUsers.coins} + ${coins}`, allTimeHighScore: sql`greatest(${telegramUsers.allTimeHighScore}, ${score})` })
      if (coins > 0) await tx.insert(coinTransactions).values({ userId, amount: coins, reason: CoinReason.RUN });

      // Se l'utente era stato invitato ed è in stato PENDING, qualifica il referral e premia l'invitante
      const [pendingRef] = await tx
        .select()
        .from(referrals)
        .where(and(eq(referrals.invitedUserId, userId), eq(referrals.status, ReferralStatus.PENDING)))
        .limit(1);

      if (pendingRef) {
        const REFERRAL_REWARD_COINS = 100;
        await tx
          .update(referrals)
          .set({ status: ReferralStatus.QUALIFIED, qualifiedAt: new Date() })
          .where(eq(referrals.id, pendingRef.id));

        await tx
          .update(telegramUsers)
          .set({ coins: sql`${telegramUsers.coins} + ${REFERRAL_REWARD_COINS}` })
          .where(eq(telegramUsers.id, pendingRef.inviterUserId));

        await tx.insert(coinTransactions).values({
          userId: pendingRef.inviterUserId,
          amount: REFERRAL_REWARD_COINS,
          reason: CoinReason.REFERRAL,
        });
      }

      return { newBest, coinsEarned: coins };
    });
  };

  let result = await close(run);
  if (!result) {
    run = await load();
    if (run?.status === "running") result = await close(run);
  }
  if (!result) throw new HttpError(409, "Partita già chiusa");
  return { ...result, profile: await buildProfile(userId) };
}

export async function revive(userId: number, runId: string, pay: RevivePay): Promise<{ ok: boolean; invoiceLink?: string }> {
  if (pay === "stars") {
    const [run] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, userId))).limit(1);
    if (!run || run.status !== "running" || run.revived) throw bad("Revive non disponibile");
    const invoiceLink = await createInvoice(userId, { purpose: "revive", runId, stars: REVIVE_PRICE.stars, title: "Revive", description: "Riparti dal punto in cui sei caduto" });
    return { ok: true, invoiceLink };
  }
  return withTx(async (tx) => {
    const [run] = await tx.select().from(runs).where(and(eq(runs.id, runId), eq(runs.userId, userId))).for("update");
    if (!run || run.status !== "running" || run.revived) throw bad("Revive non disponibile");
    const player = await lockPlayer(tx, userId);
    if (pay === "coins") {
      if (player.coins < REVIVE_PRICE.coins) return { ok: false };
      await tx.update(telegramUsers).set({ coins: sql`${telegramUsers.coins} - ${REVIVE_PRICE.coins}` }).where(eq(telegramUsers.id, userId));
      await tx.insert(coinTransactions).values({ userId, amount: -REVIVE_PRICE.coins, reason: CoinReason.REVIVE });
    } else {
      if (player.revives <= 0) return { ok: false };
      await tx.update(telegramUsers).set({ revives: sql`${telegramUsers.revives} - 1` }).where(eq(telegramUsers.id, userId));
    }
    await tx.update(runs).set({ revived: true }).where(eq(runs.id, run.id));
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Garage e negozio
// ---------------------------------------------------------------------------

export async function equip(userId: number, slot: Slot, itemId: string): Promise<Profile> {
  if (!SLOTS.includes(slot)) throw bad("Slot non valido");
  await withTx(async (tx) => {
    const item = await activeItem(tx, itemId);
    if (item.kind !== slot) throw bad("Oggetto non adatto a questo slot");
    if (!(await owns(tx, userId, item))) throw bad("Oggetto non posseduto");
    const player = await lockPlayer(tx, userId);
    await tx.update(telegramUsers).set({ equipped: { ...player.equipped, [slot]: itemId } }).where(eq(telegramUsers.id, userId));
  });
  return buildProfile(userId);
}

export async function buyWithCoins(userId: number, itemId: string): Promise<Profile> {
  await withTx(async (tx) => {
    const item = await activeItem(tx, itemId);
    if (item.priceCoins === null) throw bad("Oggetto non acquistabile con le monete");
    const player = await lockPlayer(tx, userId);
    if (item.kind !== "coin_pack" && (await owns(tx, userId, item))) throw bad("Oggetto già posseduto");
    if (player.coins < item.priceCoins) throw bad("Monete insufficienti");
    await tx.update(telegramUsers).set({ coins: sql`${telegramUsers.coins} - ${item.priceCoins}` }).where(eq(telegramUsers.id, userId));
    if (item.priceCoins > 0) await tx.insert(coinTransactions).values({ userId, amount: -item.priceCoins, reason: CoinReason.PURCHASE });
    await grantItem(tx, userId, item, "coins");
  });
  return buildProfile(userId);
}

export async function buyUpgrade(userId: number, upgradeId: string): Promise<Profile> {
  if (!UPGRADE_IDS.includes(upgradeId as UpgradeId)) throw bad("Potenziamento sconosciuto");
  await withTx(async (tx) => {
    const player = await lockPlayer(tx, userId);
    const [row] = await tx
      .select({ level: max(playerUpgrades.level) })
      .from(playerUpgrades)
      .where(and(eq(playerUpgrades.userId, userId), eq(playerUpgrades.upgradeId, upgradeId)));
    const level = row?.level ?? 0;
    if (level >= MAX_UPGRADE_LEVEL) throw bad("Potenziamento già al livello massimo");
    const cost = UPGRADE_COSTS[level];
    if (player.coins < cost) throw bad("Monete insufficienti");
    await tx.update(telegramUsers).set({ coins: sql`${telegramUsers.coins} - ${cost}` }).where(eq(telegramUsers.id, userId));
    await tx.insert(coinTransactions).values({ userId, amount: -cost, reason: CoinReason.PURCHASE });
    await tx.insert(playerUpgrades).values({ userId, upgradeId, level: level + 1, cost });
  });
  return buildProfile(userId);
}

// ---------------------------------------------------------------------------
// Stelle Telegram
// ---------------------------------------------------------------------------

async function createInvoice(
  userId: number,
  p: { purpose: "item" | "revive"; itemId?: string; runId?: string; stars: number; title: string; description: string },
): Promise<string> {
  const payload = randomBytes(16).toString("hex");
  await db.insert(starPayments).values({ userId, payload, purpose: p.purpose, itemId: p.itemId ?? null, runId: p.runId ?? null, stars: p.stars });
  // import ritardato: il bot richiede BOT_API_KEY, che serve solo qui
  const { bot } = await import("@/telegram/bot");
  return bot.telegram.createInvoiceLink({
    title: p.title.slice(0, 32),
    description: p.description.slice(0, 255),
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: p.title.slice(0, 32), amount: p.stars }],
  });
}

export async function createStarsInvoice(userId: number, itemId: string): Promise<{ invoiceLink: string }> {
  const item = await activeItem(db, itemId);
  if (item.priceStars === null) throw bad("Oggetto non acquistabile con le Stelle");
  if (item.kind !== "coin_pack") {
    const owned = await ownedIds(userId);
    if (owned.has(item.id)) throw bad("Oggetto già posseduto");
  }
  const description =
    item.kind === "coin_pack" ? `${item.coins ?? 0} monete` : item.kind === "starter_pack" ? "Pacchetto di benvenuto" : `Sblocca ${item.name}`;
  const invoiceLink = await createInvoice(userId, { purpose: "item", itemId: item.id, stars: item.priceStars, title: item.name, description });
  return { invoiceLink };
}

// ---------------------------------------------------------------------------
// Monetizzazione e Progressioni (ADS & Referral)
// ---------------------------------------------------------------------------

/**
 * Registra una visione pubblicitaria (ADS) per guadagnare monete o progredire nello sblocco di un oggetto.
 */
export async function watchAd(
  userId: number,
  options?: { itemId?: string; providerRef?: string }
): Promise<{ ok: boolean; rewardedCoins: number; itemUnlocked?: boolean; progress?: number; profile: Profile }> {
  return withTx(async (tx) => {
    const player = await lockPlayer(tx, userId);
    const rewardCoins = 25; // Monete bonus base per visualizzazione ad

    // Salva record in Ad_Views
    await tx.insert(adViews).values({
      userId,
      purpose: options?.itemId ? AdPurpose.UNLOCK_ITEM : AdPurpose.COIN_BONUS,
      providerRef: options?.providerRef ?? null,
      rewardCoins,
    });

    // Incrementa contatore globale dell'utente
    await tx
      .update(telegramUsers)
      .set({
        adsWatchedTotal: sql`${telegramUsers.adsWatchedTotal} + 1`,
        coins: sql`${telegramUsers.coins} + ${rewardCoins}`,
      })
      .where(eq(telegramUsers.id, userId));

    await tx.insert(coinTransactions).values({
      userId,
      amount: rewardCoins,
      reason: CoinReason.AD,
    });

    let itemUnlocked = false;
    let progress = 0;

    // Se la pubblicità era finalizzata allo sblocco di un oggetto
    if (options?.itemId) {
      const item = await activeItem(tx, options.itemId);
      const alreadyOwned = await owns(tx, userId, item);
      if (!alreadyOwned) {
        // Ogni 5 video visti sblocca l'oggetto
        const ADS_REQUIRED = 5;
        const [existing] = await tx
          .select()
          .from(unlockProgress)
          .where(eq(unlockProgress.userId, userId))
          .limit(1);

        progress = (existing?.progress ?? 0) + 1;
        if (existing) {
          await tx
            .update(unlockProgress)
            .set({ progress, updatedAt: new Date() })
            .where(eq(unlockProgress.id, existing.id));
        } else {
          await tx.insert(unlockProgress).values({ userId, progress, updatedAt: new Date() });
        }

        if (progress >= ADS_REQUIRED) {
          await grantItem(tx, userId, item, "ads");
          itemUnlocked = true;
        }
      }
    }

    const updatedProfile = await buildProfile(userId);
    return { ok: true, rewardedCoins: rewardCoins, itemUnlocked, progress, profile: updatedProfile };
  });
}

/**
 * Statistiche di sblocco e referral per l'utente
 */
export async function getMilestones(userId: number) {
  const [player] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, userId)).limit(1);
  if (!player) throw new HttpError(404, "Giocatore non trovato");

  const [referralsCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(and(eq(referrals.inviterUserId, userId), eq(referrals.status, ReferralStatus.QUALIFIED)));

  return {
    adsWatchedTotal: player.adsWatchedTotal,
    referralsCount: Number(referralsCount?.count ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Classifica
// ---------------------------------------------------------------------------

export async function leaderboard(scope: "global" | "weekly"): Promise<LeaderboardEntry[]> {
  let rows: { userId: number; displayName: string | null; username: string | null; score: number | null }[];
  if (scope === "weekly") {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const best = max(runs.score);
    rows = await db
      .select({ userId: telegramUsers.id, displayName: telegramUsers.displayName, username: telegramUsers.username, score: best })
      .from(runs)
      .innerJoin(telegramUsers, eq(telegramUsers.id, runs.userId))
      .where(and(gt(runs.finishedAt, since), isNotNull(runs.score), eq(telegramUsers.isBanned, false)))
      .groupBy(telegramUsers.id)
      .orderBy(desc(best))
      .limit(50);
  } else {
    rows = await db
      .select({ userId: telegramUsers.id, displayName: telegramUsers.displayName, username: telegramUsers.username, score: telegramUsers.allTimeHighScore })
      .from(telegramUsers)
      .where(and(gt(telegramUsers.allTimeHighScore, 0), eq(telegramUsers.isBanned, false)))
      .orderBy(desc(telegramUsers.allTimeHighScore))
      .limit(50);
  }
  return rows.map((r, i) => ({ rank: i + 1, userId: String(r.userId), name: playerName(r), score: r.score ?? 0 }));
}
