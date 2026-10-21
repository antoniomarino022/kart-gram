import { and, count, desc, eq, gt, gte, inArray, isNotNull, lt, max } from "drizzle-orm";
import { db } from "@/db";
import { referrals, runs, telegramUsers } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { playerName } from "@/lib/game-helpers";
import { handle } from "@/lib/http";
import { redis } from "@/lib/redis";
import type { LeaderboardRow, LeaderboardScope } from "@/types/game";

const LEADERBOARD_SIZE = 10;

/** Calcola l'inizio e la fine del mese corrente */
function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, nextMonth, yearMonth };
}

/**
 * 1. Classifica Mensile Score (Punteggi):
 * Miglior score ottenuto nelle partite concluse nel mese corrente.
 */
async function monthlyScoreRows(): Promise<LeaderboardRow[]> {
  const { start, nextMonth, yearMonth } = getCurrentMonthBounds();
  const redisKey = `leaderboard:monthly:score:${yearMonth}`;

  try {
    const redisEntries = await redis.zrange<{ member: string; score: number }[]>(
      redisKey,
      0,
      LEADERBOARD_SIZE - 1,
      { rev: true, withScores: true }
    );

    if (redisEntries && redisEntries.length > 0) {
      const userIds = redisEntries.map((e) => Number(e.member)).filter((id) => !Number.isNaN(id));
      if (userIds.length > 0) {
        const users = await db
          .select({
            id: telegramUsers.id,
            displayName: telegramUsers.displayName,
            username: telegramUsers.username,
            isBanned: telegramUsers.isBanned,
          })
          .from(telegramUsers)
          .where(inArray(telegramUsers.id, userIds));

        const userMap = new Map(users.map((u) => [u.id, u]));
        const rows: LeaderboardRow[] = [];

        for (const entry of redisEntries) {
          const u = userMap.get(Number(entry.member));
          if (u && !u.isBanned) {
            rows.push({
              userId: u.id,
              displayName: u.displayName,
              username: u.username,
              score: entry.score,
            });
          }
        }
        return rows;
      }
    }
  } catch (err) {
    console.error("Redis monthly score leaderboard error, fallback to DB:", err);
  }

  // Fallback DB
  const bestScore = max(runs.score);
  const dbRows = await db
    .select({
      userId: telegramUsers.id,
      displayName: telegramUsers.displayName,
      username: telegramUsers.username,
      score: bestScore,
    })
    .from(runs)
    .innerJoin(telegramUsers, eq(telegramUsers.id, runs.userId))
    .where(
      and(
        gte(runs.finishedAt, start),
        lt(runs.finishedAt, nextMonth),
        isNotNull(runs.score),
        eq(telegramUsers.isBanned, false),
      )
    )
    .groupBy(telegramUsers.id)
    .orderBy(desc(bestScore))
    .limit(LEADERBOARD_SIZE);

  // Warmup Redis
  if (dbRows.length > 0) {
    try {
      const zaddItems = dbRows
        .filter((r) => (r.score ?? 0) > 0)
        .map((r) => ({ score: r.score!, member: String(r.userId) }));

      const [first, ...rest] = zaddItems;
      if (first) {
        await redis.zadd(redisKey, first, ...rest);
        // Scadenza a 35 giorni
        await redis.expire(redisKey, 35 * 24 * 3600);
      }
    } catch (err) {
      console.error("Redis warmup error:", err);
    }
  }

  return dbRows;
}

/**
 * 2. Classifica Mensile Condivisioni (Referral invitati nel mese corrente).
 */
async function monthlyReferralRows(): Promise<LeaderboardRow[]> {
  const { start, nextMonth, yearMonth } = getCurrentMonthBounds();
  const redisKey = `leaderboard:monthly:referrals:${yearMonth}`;

  try {
    const redisEntries = await redis.zrange<{ member: string; score: number }[]>(
      redisKey,
      0,
      LEADERBOARD_SIZE - 1,
      { rev: true, withScores: true }
    );

    if (redisEntries && redisEntries.length > 0) {
      const userIds = redisEntries.map((e) => Number(e.member)).filter((id) => !Number.isNaN(id));
      if (userIds.length > 0) {
        const users = await db
          .select({
            id: telegramUsers.id,
            displayName: telegramUsers.displayName,
            username: telegramUsers.username,
            isBanned: telegramUsers.isBanned,
          })
          .from(telegramUsers)
          .where(inArray(telegramUsers.id, userIds));

        const userMap = new Map(users.map((u) => [u.id, u]));
        const rows: LeaderboardRow[] = [];

        for (const entry of redisEntries) {
          const u = userMap.get(Number(entry.member));
          if (u && !u.isBanned) {
            rows.push({
              userId: u.id,
              displayName: u.displayName,
              username: u.username,
              score: entry.score,
            });
          }
        }
        return rows;
      }
    }
  } catch (err) {
    console.error("Redis monthly referrals leaderboard error, fallback to DB:", err);
  }

  // Fallback DB: conta gli invitati registrati nel mese
  const refCount = count(referrals.id);
  const dbRows = await db
    .select({
      userId: telegramUsers.id,
      displayName: telegramUsers.displayName,
      username: telegramUsers.username,
      score: refCount,
    })
    .from(referrals)
    .innerJoin(telegramUsers, eq(telegramUsers.id, referrals.inviterUserId))
    .where(
      and(
        gte(referrals.createdAt, start),
        lt(referrals.createdAt, nextMonth),
        eq(telegramUsers.isBanned, false),
      )
    )
    .groupBy(telegramUsers.id)
    .orderBy(desc(refCount))
    .limit(LEADERBOARD_SIZE);

  // Warmup Redis
  if (dbRows.length > 0) {
    try {
      const zaddItems = dbRows
        .filter((r) => (r.score ?? 0) > 0)
        .map((r) => ({ score: r.score!, member: String(r.userId) }));

      const [first, ...rest] = zaddItems;
      if (first) {
        await redis.zadd(redisKey, first, ...rest);
        await redis.expire(redisKey, 35 * 24 * 3600);
      }
    } catch (err) {
      console.error("Redis referrals warmup error:", err);
    }
  }

  return dbRows;
}

/**
 * GET /api/game/leaderboard?scope=score|referrals
 *
 * Restituisce la Top 10 mensile richiesta (miglior punteggio o più condivisioni).
 */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);

  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope: LeaderboardScope = scopeParam === "referrals" ? "referrals" : "score";
  const rows = await (scope === "referrals" ? monthlyReferralRows() : monthlyScoreRows());

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.userId),
    name: playerName(row),
    score: row.score ?? 0,
  }));
});
