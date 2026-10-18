import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { revokeFromPlayer } from "@/server/admin-players";
import { playerIdFrom } from "../../params";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

/** DELETE /api/admin/players/:id/items/:itemId - toglie un oggetto posseduto */
export const DELETE = handle(async (request: Request, context: Ctx) => {
  await requireAdmin(request);
  const { itemId } = await context.params;
  return revokeFromPlayer(await playerIdFrom(context), itemId);
});
