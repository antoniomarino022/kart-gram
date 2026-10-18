import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { playerItems } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handle } from "@/lib/http";
import type { PlayerItemParamContext } from "@/types/admin";
import { loadPlayerDetail, parsePlayerId } from "../../params";

/**
 * DELETE /api/admin/players/:id/items/:itemId
 *
 * Rimuove un oggetto posseduto (`Player_Items`) dall'inventario del giocatore
 * e restituisce il dettaglio giocatore aggiornato.
 */
export const DELETE = handle(async (request: Request, context: PlayerItemParamContext) => {
  await requireAdmin(request);

  const playerId = await parsePlayerId(context);
  const { itemId } = await context.params;

  await db
    .delete(playerItems)
    .where(and(eq(playerItems.userId, playerId), eq(playerItems.itemId, itemId)));

  return loadPlayerDetail(playerId);
});
