import { count, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { runs, starPayments, telegramUsers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";

/**
 * GET /api/admin/stats
 *
 * Restituisce le statistiche generali per la home della Dashboard Admin:
 * - `players`: totale iscritti, nuovi negli ultimi 7 giorni, bannati, monete totali in circolazione;
 * - `activity`: partite giocate nelle ultime 24h, negli ultimi 7 giorni e utenti attivi settimanali;
 * - `stars`: totale Telegram Stars incassate, incasso degli ultimi 30 giorni e numero pagamenti completati;
 * - `bestScore`: record assoluto tra tutti i giocatori.
 *
 * Richiede sessione Better Auth con ruolo `admin`.
 */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);

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
});
