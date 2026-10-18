import { count, desc, eq, ilike, max, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { runs, telegramUsers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { playerName } from "@/lib/game-helpers";
import { handle, pageFrom, searchQueryFrom } from "@/lib/http";

/**
 * Costruisce il filtro SQL per cercare un giocatore tramite `displayName`, `username`,
 * `id` interno oppure `telegramId`.
 */
function buildSearchFilter(query: string): SQL | undefined {
  if (!query) {
    return undefined;
  }

  const likePattern = `%${query.replace(/[\\%_]/g, (char) => "\\" + char)}%`;
  const numericQuery = Number(query);

  const numericFilters = Number.isSafeInteger(numericQuery)
    ? [
        eq(telegramUsers.telegramId, numericQuery),
        eq(telegramUsers.id, numericQuery),
      ]
    : [];

  return or(
    ilike(telegramUsers.displayName, likePattern),
    ilike(telegramUsers.username, likePattern),
    ...numericFilters,
  );
}

/**
 * GET /api/admin/players?q=<ricerca>&page=<numero>
 *
 * Restituisce la lista paginata (50 per pagina) dei giocatori registrati, ordinata per
 * `allTimeHighScore` decrescente, includendo il conteggio partite (`runs`) e la data
 * dell'ultima partita (`lastRunAt`).
 */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const query = searchQueryFrom(searchParams);
  const page = pageFrom(searchParams);
  const where = buildSearchFilter(query);

  const runStats = db
    .select({
      userId: runs.userId,
      runs: count().as("runs"),
      lastRunAt: max(runs.startedAt).as("last_run_at"),
    })
    .from(runs)
    .groupBy(runs.userId)
    .as("rs");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        player: telegramUsers,
        runs: runStats.runs,
        lastRunAt: runStats.lastRunAt,
      })
      .from(telegramUsers)
      .leftJoin(runStats, eq(runStats.userId, telegramUsers.id))
      .where(where)
      .orderBy(desc(telegramUsers.allTimeHighScore), desc(telegramUsers.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(telegramUsers).where(where),
  ]);

  return {
    total,
    page,
    pageSize: PAGE_SIZE,
    players: rows.map(({ player, runs: runCount, lastRunAt }) => ({
      id: player.id,
      telegramId: player.telegramId,
      name: playerName(player),
      username: player.username,
      profileIcon: player.profileIcon,
      coins: player.coins,
      bestScore: player.allTimeHighScore,
      revives: player.revives,
      isBanned: player.isBanned,
      createdAt: player.createdAt,
      runs: Number(runCount ?? 0),
      lastRunAt,
    })),
  };
});
