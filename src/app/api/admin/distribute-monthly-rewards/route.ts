import { and, count, desc, eq, gte, isNotNull, lt, max, sql } from "drizzle-orm";
import { db, withTx } from "@/db";
import { coinTransactions, referrals, runs, telegramUsers } from "@/db/schema";
import { CoinReason } from "@/types/enums";
import { handle, HttpError } from "@/lib/http";
import { bot } from "@/telegram/bot";

const REWARDS = [150, 100, 50]; // 1°, 2°, 3° posto

/**
 * Calcola i limiti temporali per il mese appena concluso.
 */
function getPreviousMonthBounds() {
  const now = new Date();
  const startOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0));
  const endOfPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const monthLabel = `${startOfPreviousMonth.getUTCFullYear()}-${String(startOfPreviousMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start: startOfPreviousMonth, end: endOfPreviousMonth, monthLabel };
}

/**
 * POST /api/admin/distribute-monthly-rewards
 *
 * Assegna le ricompense mensili ai primi 3 classificati di entrambe le categorie:
 * - 🏆 Classifica Punti (Top 3): 150, 100, 50 monete
 * - 👥 Classifica Inviti/Referral (Top 3): 150, 100, 50 monete
 *
 * Invia inoltre un messaggio Telegram di congratulazioni ai vincitori se il bot è attivo.
 */
export const POST = handle(async (request: Request) => {
  // Verifica segreto o autorizzazione per cron job / admin
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    throw new HttpError(401, "Non autorizzato");
  }

  const { start, end, monthLabel } = getPreviousMonthBounds();

  // 1. Top 3 Score del mese precedente
  const topScore = await db
    .select({
      userId: telegramUsers.id,
      telegramId: telegramUsers.telegramId,
      displayName: telegramUsers.displayName,
      score: max(runs.score),
    })
    .from(runs)
    .innerJoin(telegramUsers, eq(telegramUsers.id, runs.userId))
    .where(
      and(
        gte(runs.finishedAt, start),
        lt(runs.finishedAt, end),
        isNotNull(runs.score),
        eq(telegramUsers.isBanned, false),
      )
    )
    .groupBy(telegramUsers.id)
    .orderBy(desc(max(runs.score)))
    .limit(3);

  // 2. Top 3 Inviti/Referral del mese precedente
  const refCount = count(referrals.id);
  const topReferrals = await db
    .select({
      userId: telegramUsers.id,
      telegramId: telegramUsers.telegramId,
      displayName: telegramUsers.displayName,
      score: refCount,
    })
    .from(referrals)
    .innerJoin(telegramUsers, eq(telegramUsers.id, referrals.inviterUserId))
    .where(
      and(
        gte(referrals.createdAt, start),
        lt(referrals.createdAt, end),
        eq(telegramUsers.isBanned, false),
      )
    )
    .groupBy(telegramUsers.id)
    .orderBy(desc(refCount))
    .limit(3);

  const distributed = [];

  // Distribuzione premi Punteggio
  for (let i = 0; i < topScore.length; i++) {
    const winner = topScore[i];
    const prize = REWARDS[i];
    if (!winner || !prize) continue;

    await withTx(async (tx) => {
      await tx
        .update(telegramUsers)
        .set({ coins: sql`${telegramUsers.coins} + ${prize}` })
        .where(eq(telegramUsers.id, winner.userId));

      await tx.insert(coinTransactions).values({
        userId: winner.userId,
        amount: prize,
        reason: CoinReason.MONTHLY_REWARD,
      });
    });

    distributed.push({ type: "score", rank: i + 1, userId: winner.userId, prize });

    // Notifica Telegram opzionale
    try {
      if (winner.telegramId) {
        await bot.telegram.sendMessage(
          winner.telegramId,
          `🏆 Congratulazioni! Sei arrivato ${i + 1}° nella classifica mensile punteggi (${monthLabel}) e hai vinto ${prize} Monete!`
        );
      }
    } catch (e) {
      console.error(`Notifica non inviata all'utente ${winner.userId}:`, e);
    }
  }

  // Distribuzione premi Referral
  for (let i = 0; i < topReferrals.length; i++) {
    const winner = topReferrals[i];
    const prize = REWARDS[i];
    if (!winner || !prize) continue;

    await withTx(async (tx) => {
      await tx
        .update(telegramUsers)
        .set({ coins: sql`${telegramUsers.coins} + ${prize}` })
        .where(eq(telegramUsers.id, winner.userId));

      await tx.insert(coinTransactions).values({
        userId: winner.userId,
        amount: prize,
        reason: CoinReason.MONTHLY_REWARD,
      });
    });

    distributed.push({ type: "referrals", rank: i + 1, userId: winner.userId, prize });

    try {
      if (winner.telegramId) {
        await bot.telegram.sendMessage(
          winner.telegramId,
          `👥 Congratulazioni! Sei arrivato ${i + 1}° nella classifica mensile inviti (${monthLabel}) e hai vinto ${prize} Monete!`
        );
      }
    } catch (e) {
      console.error(`Notifica non inviata all'utente ${winner.userId}:`, e);
    }
  }

  return {
    success: true,
    month: monthLabel,
    distributed,
  };
});
