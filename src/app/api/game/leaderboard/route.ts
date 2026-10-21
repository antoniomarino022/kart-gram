import { and, count, desc, eq, gte, isNotNull, lt, max } from "drizzle-orm";
import { db } from "@/db";
import { referrals, runs, telegramUsers } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { playerName } from "@/lib/game-helpers";
import { handle } from "@/lib/http";
import { redis, withRedisTimeout } from "@/lib/redis";
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

// Breve cache in RAM di 30 secondi per non sovraccaricare né DB né Redis se l'utente clicca più volte
const localLeaderboardCache = new Map<string, { data: LeaderboardRow[]; expiresAt: number }>();

/**
 * 1. Classifica Mensile Score (Punteggi):
 * Query Postgres veloce + warmup Redis non bloccante.
 */
async function monthlyScoreRows(): Promise<LeaderboardRow[]> {
  const { start, nextMonth, yearMonth } = getCurrentMonthBounds();
  const cacheKey = `score:${yearMonth}`;

  const cached = localLeaderboardCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const redisKey = `leaderboard:monthly:score:${yearMonth}`;

  // Prova Redis solo se risponde entro 150ms
  const redisEntries = await withRedisTimeout(
    redis.zrange<{ member: string; score: number }[]>(
      redisKey,
      0,
      LEADERBOARD_SIZE - 1,
      { rev: true, withScores: true }
    ),
    150
  );

  // Se Redis è pronto e ha dati, restituisci
  if (redisEntries && redisEntries.length > 0) {
    // Se abbiamo i dati in Redis, prendiamo i dati dal DB
    const userIds = redisEntries.map((e) => Number(e.member)).filter((id) => !Number.isNaN(id));
    if (userIds.length > 0) {
      const users = await db
        .select({
          id: telegramUsers.id,
          displayName: telegramUsers.displayName,
          username: telegramUsers.username,
          isBanned: telegramUsers.isBanned,
        })
        .from(telegramUsers);

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

      if (rows.length > 0) {
        localLeaderboardCache.set(cacheKey, { data: rows, expiresAt: Date.now() + 30_000 });
        return rows;
      }
    }
  }

  // Altrimenti esegui la query Postgres (che è velocissima sulla Top 10)
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

  localLeaderboardCache.set(cacheKey, { data: dbRows, expiresAt: Date.now() + 30_000 });

  // Popola Redis asincronamente in background (non blocca la risposta)
  if (dbRows.length > 0) {
    void (async () => {
      try {
        const zaddItems = dbRows
          .filter((r) => (r.score ?? 0) > 0)
          .map((r) => ({ score: r.score!, member: String(r.userId) }));

        const [first, ...rest] = zaddItems;
        if (first) {
          await redis.zadd(redisKey, first, ...rest);
          await redis.expire(redisKey, 35 * 24 * 3600);
        }
      } catch {
        // Ignora silenziosamente errori di background warmup
      }
    })();
  }

  return dbRows;
}

/**
 * 2. Classifica Mensile Condivisioni (Referral invitati nel mese corrente).
 */
async function monthlyReferralRows(): Promise<LeaderboardRow[]> {
  const { start, nextMonth, yearMonth } = getCurrentMonthBounds();
  const cacheKey = `ref:${yearMonth}`;

  const cached = localLeaderboardCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const redisKey = `leaderboard:monthly:referrals:${yearMonth}`;

  // Prova Redis entro 150ms
  const redisEntries = await withRedisTimeout(
    redis.zrange<{ member: string; score: number }[]>(
      redisKey,
      0,
      LEADERBOARD_SIZE - 1,
      { rev: true, withScores: true }
    ),
    150
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
        .from(telegramUsers);

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

      if (rows.length > 0) {
        localLeaderboardCache.set(cacheKey, { data: rows, expiresAt: Date.now() + 30_000 });
        return rows;
      }
    }
  }

  // Fallback DB Postgres
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

  localLeaderboardCache.set(cacheKey, { data: dbRows, expiresAt: Date.now() + 30_000 });

  if (dbRows.length > 0) {
    void (async () => {
      try {
        const zaddItems = dbRows
          .filter((r) => (r.score ?? 0) > 0)
          .map((r) => ({ score: r.score!, member: String(r.userId) }));

        const [first, ...rest] = zaddItems;
        if (first) {
          await redis.zadd(redisKey, first, ...rest);
          await redis.expire(redisKey, 35 * 24 * 3600);
        }
      } catch {
        // Ignora errori di background
      }
    })();
  }

  return dbRows;
}

/**
 * GET /api/game/leaderboard?scope=score|referrals
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
