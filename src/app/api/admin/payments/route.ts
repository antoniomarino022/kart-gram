import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, starPayments, telegramUsers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { playerName } from "@/lib/game-helpers";
import { handle, pageFrom } from "@/lib/http";

/**
 * GET /api/admin/payments?page=<numero>
 *
 * Restituisce lo storico paginato (50 righe per pagina) di tutte le transazioni in Telegram Stars
 * (`pending`, `paid`, `refunded`), arricchito con il nome del giocatore (`playerName`) e il nome
 * dell'eventuale oggetto acquistato (`itemName`).
 *
 * Richiede sessione Better Auth con ruolo `admin`.
 */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const page = pageFrom(searchParams);

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
});
