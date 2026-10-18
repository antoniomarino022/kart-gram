import { z } from "zod";
import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { buyUpgrade } from "@/server/game/service";

const body = z.object({ upgradeId: z.string().min(1).max(20) });

/** POST /api/game/upgrades - livello successivo di un potenziamento */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  return buyUpgrade(player.id, body.parse(await request.json()).upgradeId);
});
