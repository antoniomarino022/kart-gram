import { count, desc, eq, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, runs, starPayments, telegramUsers } from "@/db/schema";
import { playerName } from "@/server/game/player";
import { PAGE_SIZE } from "./pagination";

export async function stats() {
  const oneDayAgo = sql`now() - interval '1 day'`;
  const oneWeekAgo = sql`now() - interval '7 days'`;
  const oneMonthAgo = sql`now() - interval '30 days'`;

  const [[players], [activity], [stars], [top]] = await Promise.all([
    db
      .select({
        total: count(),
        newWeek: sql<number>`count(*) filter (where ${telegramUsers.createdAt} > ${oneWeekAgo})`.mapWith(Number),
        banned: sql<number>`count(*) filter (where ${telegramUsers.isBanned})`.mapWith(Number),
        coins: sql<number>`coalesce(sum(${telegramUsers.coins}), 0)`.mapWith(Number),
      })
      .from(telegramUsers),
    db
      .select({
        runsDay: sql<number>`count(*) filter (where ${runs.startedAt} > ${oneDayAgo})`.mapWith(Number),
        runsWeek: sql<number>`count(*) filter (where ${runs.startedAt} > ${oneWeekAgo})`.mapWith(Number),
        activeWeek: sql<number>`count(distinct ${runs.userId}) filter (where ${runs.startedAt} > ${oneWeekAgo})`.mapWith(Number),
      })
      .from(runs),
    db
      .select({
        total: sql<number>`coalesce(sum(${starPayments.stars}) filter (where ${starPayments.status} = 'paid'), 0)`.mapWith(Number),
        month: sql<number>`coalesce(sum(${starPayments.stars}) filter (where ${starPayments.status} = 'paid' and ${starPayments.paidAt} > ${oneMonthAgo}), 0)`.mapWith(Number),
        paidCount: sql<number>`count(*) filter (where ${starPayments.status} = 'paid')`.mapWith(Number),
      })
      .from(starPayments),
    db
      .select({ best: max(telegramUsers.allTimeHighScore) })
      .from(telegramUsers),
  ]);

  return {
    players,
    activity,
    stars,
    bestScore: top.best ?? 0,
  };
}

export async function listPayments(page: number) {
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        payment: starPayments,
        displayName: telegramUsers.displayName,
        username: telegramUsers.username,
        itemName: items.name,
      })
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
    payments: rows.map(({ payment, displayName, username, itemName }) => ({
      ...payment,
      playerName: playerName({ displayName, username }),
      itemName,
    })),
  };
}
