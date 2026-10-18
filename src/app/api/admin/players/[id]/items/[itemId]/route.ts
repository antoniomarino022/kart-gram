import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { revokeFromPlayer } from "@/server/admin/players";
import type { PlayerItemParamContext } from "@/types/admin";
import { playerIdFrom } from "../../params";

/** DELETE /api/admin/players/:id/items/:itemId - toglie un oggetto posseduto */
export const DELETE = handle(async (request: Request, context: PlayerItemParamContext) => {
  await requireAdmin(request);
  const playerId = await playerIdFrom(context);
  const { itemId } = await context.params;
  return revokeFromPlayer(playerId, itemId);
});
