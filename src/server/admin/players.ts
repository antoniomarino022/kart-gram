import { and, count, desc, eq, ilike, max, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  coinTransactions,
  items,
  playerItems,
  runs,
  starPayments,
  telegramUsers,
} from "@/db/schema";
import type { UpdatePlayerInput } from "@/types/admin";
import { HttpError } from "@/server/http";
import { withTx } from "@/server/tx";
import { grantItem } from "@/server/game/grant";
import { getPlayer, lockPlayer, playerName } from "@/server/game/player";
import { upgradeLevels } from "@/server/game/profile";
import { PAGE_SIZE } from "./pagination";

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

export async function listPlayers(query: string, page: number) {
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
}

export async function playerDetail(id: number) {
  const player = await getPlayer(id);

  const [owned, upgrades, recentRuns, payments, transactions] = await Promise.all([
    db
      .select({
        itemId: playerItems.itemId,
        name: items.name,
        kind: items.kind,
        source: playerItems.source,
        acquiredAt: playerItems.acquiredAt,
      })
      .from(playerItems)
      .innerJoin(items, eq(items.id, playerItems.itemId))
      .where(eq(playerItems.userId, id))
      .orderBy(desc(playerItems.acquiredAt)),
    upgradeLevels(id),
    db
      .select({
        id: runs.id,
        status: runs.status,
        score: runs.score,
        coins: runs.coins,
        distance: runs.distance,
        revived: runs.revived,
        startedAt: runs.startedAt,
        finishedAt: runs.finishedAt,
      })
      .from(runs)
      .where(eq(runs.userId, id))
      .orderBy(desc(runs.startedAt))
      .limit(20),
    db
      .select()
      .from(starPayments)
      .where(eq(starPayments.userId, id))
      .orderBy(desc(starPayments.createdAt))
      .limit(20),
    db
      .select()
      .from(coinTransactions)
      .where(eq(coinTransactions.userId, id))
      .orderBy(desc(coinTransactions.createdAt))
      .limit(30),
  ]);

  return {
    player: {
      id: player.id,
      telegramId: player.telegramId,
      name: playerName(player),
      displayName: player.displayName,
      username: player.username,
      profileIcon: player.profileIcon,
      coins: player.coins,
      bestScore: player.allTimeHighScore,
      revives: player.revives,
      isBanned: player.isBanned,
      equipped: player.equipped,
      createdAt: player.createdAt,
    },
    owned,
    upgrades,
    runs: recentRuns,
    payments,
    transactions,
  };
}

export async function updatePlayer(id: number, data: UpdatePlayerInput) {
  const [row] = await db
    .update(telegramUsers)
    .set(data)
    .where(eq(telegramUsers.id, id))
    .returning({ id: telegramUsers.id });

  if (!row) {
    throw new HttpError(404, "Giocatore non trovato");
  }

  return playerDetail(id);
}

export async function grantToPlayer(id: number, itemId: string) {
  await withTx(async (tx) => {
    await lockPlayer(tx, id);

    const [item] = await tx
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item) {
      throw new HttpError(400, "Oggetto sconosciuto");
    }

    await grantItem(tx, id, item, "admin");
  });

  return playerDetail(id);
}

export async function revokeFromPlayer(id: number, itemId: string) {
  await db
    .delete(playerItems)
    .where(and(eq(playerItems.userId, id), eq(playerItems.itemId, itemId)));

  return playerDetail(id);
}
