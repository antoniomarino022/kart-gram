import { z } from "zod";
import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { revive } from "@/server/game/service";
import { runIdFrom, type RunContext } from "../params";

const body = z.object({ pay: z.enum(["coins", "stars", "owned"]) });

/** POST /api/game/runs/:id/revive - revive pagato con monete, revive posseduti o Stelle (fattura) */
export const POST = handle(async (request: Request, context: RunContext) => {
  const player = await requirePlayer(request);
  const { pay } = body.parse(await request.json());
  return revive(player.id, await runIdFrom(context), pay);
});
