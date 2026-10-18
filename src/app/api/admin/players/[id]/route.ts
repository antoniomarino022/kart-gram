import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramUsers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
import { updatePlayerSchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";
import { loadPlayerDetail, parsePlayerId } from "./params";

/**
 * GET /api/admin/players/:id
 *
 * Restituisce il dettaglio completo del giocatore (profilo, oggetti posseduti, upgrade,
 * ultime partite, pagamenti Stars e movimenti monete).
 */
export const GET = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);

  const playerId = await parsePlayerId(context);
  return loadPlayerDetail(playerId);
});

/**
 * PATCH /api/admin/players/:id
 *
 * Modifica i parametri del giocatore dalla Dashboard Admin (`displayName`, `coins`, `revives`,
 * `allTimeHighScore`, `isBanned`) e restituisce il dettaglio giocatore aggiornato.
 */
export const PATCH = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);

  const playerId = await parsePlayerId(context);
  const data = updatePlayerSchema.parse(await request.json());

  const [updated] = await db
    .update(telegramUsers)
    .set(data)
    .where(eq(telegramUsers.id, playerId))
    .returning({ id: telegramUsers.id });

  if (!updated) {
    throw new HttpError(404, "Giocatore non trovato");
  }

  return loadPlayerDetail(playerId);
});
