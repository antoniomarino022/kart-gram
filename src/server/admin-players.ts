import { and, count, desc, eq, ilike, max, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coinTransactions, items, playerItems, runs, starPayments, telegramUsers } from "@/db/schema";
import { HttpError } from "@/server/http";
import { withTx } from "@/server/tx";
import { grantItem } from "@/server/game/grant";
import { upgradeLevels } from "@/server/game/profile";
import { playerName } from "@/server/game/player";

const PAGE_SIZE = 50;

export async function listPlayers(q: string, page: number) {
  let where: SQL | undefined;
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    const asNumber = Number(q);
    where = or(
      ilike(telegramUsers.displayName, like),
      ilike(telegramUsers.username, like),
      ...(Number.isSafeInteger(asNumber) ? [eq(telegramUsers.telegramId, asNumber), eq(telegramUsers.id, asNumber)] : []),
    );
  }
  const runStats = db
    .select({ userId: runs.userId, runs: count().as("runs"), lastRunAt: max(runs.startedAt).as("last_run_at") })
    .from(runs)
    .groupBy(runs.userId)
    .as("rs");
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ p: telegramUsers, runs: runStats.runs, lastRunAt: runStats.lastRunAt })
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
    players: rows.map(({ p, runs: runCount, lastRunAt }) => ({
      id: p.id,
      telegramId: p.telegramId,
      name: playerName(p),
      username: p.username,
      profileIcon: p.profileIcon,
      coins: p.coins,
      bestScore: p.allTimeHighScore,
      revives: p.revives,
      isBanned: p.isBanned,
      createdAt: p.createdAt,
      runs: Number(runCount ?? 0),
      lastRunAt,
    })),
  };
}

export async function playerDetail(id: number) {
  const [p] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, id)).limit(1);
  if (!p) throw new HttpError(404, "Giocatore non trovato");
  const [owned, upgrades, recentRuns, payments, transactions] = await Promise.all([
    db
      .select({ itemId: playerItems.itemId, name: items.name, kind: items.kind, source: playerItems.source, acquiredAt: playerItems.acquiredAt })
      .from(playerItems)
      .innerJoin(items, eq(items.id, playerItems.itemId))
      .where(eq(playerItems.userId, id))
      .orderBy(desc(playerItems.acquiredAt)),
    upgradeLevels(id),
    db
      .select({ id: runs.id, status: runs.status, score: runs.score, coins: runs.coins, distance: runs.distance, revived: runs.revived, startedAt: runs.startedAt, finishedAt: runs.finishedAt })
      .from(runs)
      .where(eq(runs.userId, id))
      .orderBy(desc(runs.startedAt))
      .limit(20),
    db.select().from(starPayments).where(eq(starPayments.userId, id)).orderBy(desc(starPayments.createdAt)).limit(20),
    db.select().from(coinTransactions).where(eq(coinTransactions.userId, id)).orderBy(desc(coinTransactions.createdAt)).limit(30),
  ]);
  return {
    player: {
      id: p.id,
      telegramId: p.telegramId,
      name: playerName(p),
      displayName: p.displayName,
      username: p.username,
      profileIcon: p.profileIcon,
      coins: p.coins,
      bestScore: p.allTimeHighScore,
      revives: p.revives,
      isBanned: p.isBanned,
      equipped: p.equipped,
      createdAt: p.createdAt,
    },
    owned,
    upgrades,
    runs: recentRuns,
    payments,
    transactions,
  };
}

export const updatePlayerSchema = z.object({
  coins: z.number().int().min(0).max(1_000_000_000).optional(),
  revives: z.number().int().min(0).max(10_000).optional(),
  isBanned: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
});

export async function updatePlayer(id: number, data: z.infer<typeof updatePlayerSchema>) {
  const [row] = await db.update(telegramUsers).set(data).where(eq(telegramUsers.id, id)).returning({ id: telegramUsers.id });
  if (!row) throw new HttpError(404, "Giocatore non trovato");
  return playerDetail(id);
}

export async function grantToPlayer(id: number, itemId: string) {
  await withTx(async (tx) => {
    const [p] = await tx.select({ id: telegramUsers.id }).from(telegramUsers).where(eq(telegramUsers.id, id)).for("update");
    if (!p) throw new HttpError(404, "Giocatore non trovato");
    const [item] = await tx.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item) throw new HttpError(400, "Oggetto sconosciuto");
    await grantItem(tx, id, item, "admin");
  });
  return playerDetail(id);
}

export async function revokeFromPlayer(id: number, itemId: string) {
  await db.delete(playerItems).where(and(eq(playerItems.userId, id), eq(playerItems.itemId, itemId)));
  return playerDetail(id);
}

export async function stats() {
  const day = sql`now() - interval '1 day'`;
  const week = sql`now() - interval '7 days'`;
  const month = sql`now() - interval '30 days'`;
  const [[players], [activity], [stars], [top]] = await Promise.all([
    db
      .select({
        total: count(),
        newWeek: sql<number>`count(*) filter (where ${telegramUsers.createdAt} > ${week})`.mapWith(Number),
        banned: sql<number>`count(*) filter (where ${telegramUsers.isBanned})`.mapWith(Number),
        coins: sql<number>`coalesce(sum(${telegramUsers.coins}), 0)`.mapWith(Number),
      })
      .from(telegramUsers),
    db
      .select({
        runsDay: sql<number>`count(*) filter (where ${runs.startedAt} > ${day})`.mapWith(Number),
        runsWeek: sql<number>`count(*) filter (where ${runs.startedAt} > ${week})`.mapWith(Number),
        activeWeek: sql<number>`count(distinct ${runs.userId}) filter (where ${runs.startedAt} > ${week})`.mapWith(Number),
      })
      .from(runs),
    db
      .select({
        total: sql<number>`coalesce(sum(${starPayments.stars}) filter (where ${starPayments.status} = 'paid'), 0)`.mapWith(Number),
        month: sql<number>`coalesce(sum(${starPayments.stars}) filter (where ${starPayments.status} = 'paid' and ${starPayments.paidAt} > ${month}), 0)`.mapWith(Number),
        paidCount: sql<number>`count(*) filter (where ${starPayments.status} = 'paid')`.mapWith(Number),
      })
      .from(starPayments),
    db.select({ best: max(telegramUsers.allTimeHighScore) }).from(telegramUsers),
  ]);
  return { players, activity, stars, bestScore: top.best ?? 0 };
}

export async function listPayments(page: number) {
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ p: starPayments, name: telegramUsers.displayName, username: telegramUsers.username, itemName: items.name })
      .from(starPayments)
      .innerJoin(telegramUsers, eq(telegramUsers.id, starPayments.userId))
      .leftJoin(items, eq(items.id, starPayments.itemId))
      .orderBy(desc(starPayments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(starPayments),
  ]);
  return {
    total,
    page,
    pageSize: PAGE_SIZE,
    payments: rows.map(({ p, name, username, itemName }) => ({ ...p, playerName: playerName({ displayName: name, username }), itemName })),
  };
}
