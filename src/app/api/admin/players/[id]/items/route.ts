import { z } from "zod";
import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { grantToPlayer } from "@/server/admin-players";
import { playerIdFrom } from "../params";

const body = z.object({ itemId: z.string().min(1).max(64) });

/** POST /api/admin/players/:id/items - regala un oggetto (o un pacchetto) */
export const POST = handle(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  await requireAdmin(request);
  return grantToPlayer(await playerIdFrom(context), body.parse(await request.json()).itemId);
});
