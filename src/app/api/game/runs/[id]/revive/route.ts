import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { revive } from "@/server/game/runs";
import { reviveBodySchema } from "@/schemas/game";
import type { IdParamContext } from "@/types/game";
import { runIdFrom } from "../params";

/** POST /api/game/runs/:id/revive - revive pagato con monete, revive posseduti o Stelle (fattura) */
export const POST = handle(async (request: Request, context: IdParamContext) => {
  const player = await requirePlayer(request);
  const runId = await runIdFrom(context);
  const { pay } = reviveBodySchema.parse(await request.json());
  return revive(player.id, runId, pay);
});
