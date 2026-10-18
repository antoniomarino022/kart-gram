import { and, desc, eq, gt, isNotNull, max } from "drizzle-orm";
import { db } from "@/db";
import { runs, telegramUsers } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { playerName } from "@/lib/game-helpers";
import { handle } from "@/lib/http";
import type { LeaderboardRow, LeaderboardScope } from "@/types/game";

const LEADERBOARD_SIZE = 50;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * Classifica settimanale: miglior punteggio ottenuto da ciascun giocatore non bannato
 * nelle partite concluse negli ultimi 7 giorni.
 */
function weeklyRows(): Promise<LeaderboardRow[]> {
  const since = new Date(Date.now() - WEEK_MS);
  const bestScore = max(runs.score);

  return db
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
        gt(runs.finishedAt, since),
        isNotNull(runs.score),
        eq(telegramUsers.isBanned, false),
      ),
    )
    .groupBy(telegramUsers.id)
    .orderBy(desc(bestScore))
    .limit(LEADERBOARD_SIZE);
}

/**
 * Classifica globale: record assoluto (`allTimeHighScore`) dei migliori 50 giocatori non bannati.
 */
function globalRows(): Promise<LeaderboardRow[]> {
  return db
    .select({
      userId: telegramUsers.id,
      displayName: telegramUsers.displayName,
      username: telegramUsers.username,
      score: telegramUsers.allTimeHighScore,
    })
    .from(telegramUsers)
    .where(
      and(
        gt(telegramUsers.allTimeHighScore, 0),
        eq(telegramUsers.isBanned, false),
      ),
    )
    .orderBy(desc(telegramUsers.allTimeHighScore))
    .limit(LEADERBOARD_SIZE);
}

/**
 * GET /api/game/leaderboard?scope=global|weekly
 *
 * Restituisce la Top 50 della classifica richiesta (`global` di default oppure `weekly`).
 * Esclude sempre gli account sospesi (`isBanned = true`).
 */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);

  const scopeParam = new URL(request.url).searchParams.get("scope");
  const scope: LeaderboardScope = scopeParam === "weekly" ? "weekly" : "global";
  const rows = await (scope === "weekly" ? weeklyRows() : globalRows());

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.userId),
    name: playerName(row),
    score: row.score ?? 0,
  }));
});
