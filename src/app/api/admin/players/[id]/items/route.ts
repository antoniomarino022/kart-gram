import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { grantToPlayer } from "@/server/admin/players";
import { grantItemBodySchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";
import { playerIdFrom } from "../params";

/** POST /api/admin/players/:id/items - regala un oggetto (o un pacchetto) */
export const POST = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);
  const playerId = await playerIdFrom(context);
  const { itemId } = grantItemBodySchema.parse(await request.json());
  return grantToPlayer(playerId, itemId);
});
