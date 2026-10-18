import { and, desc, eq, gt, isNotNull, max } from "drizzle-orm";
import { db } from "@/db";
import { runs, telegramUsers } from "@/db/schema";
import type { LeaderboardEntry } from "@/backend/types";
import type { LeaderboardRow, LeaderboardScope } from "@/types/game";
import { playerName } from "./player";

const LEADERBOARD_SIZE = 50;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Miglior punteggio degli ultimi 7 giorni, dalle partite chiuse. */
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

/** Record di sempre, salvato sul giocatore. */
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

export async function leaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
  const rows = await (scope === "weekly" ? weeklyRows() : globalRows());

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: String(row.userId),
    name: playerName(row),
    score: row.score ?? 0,
  }));
}
