import { z } from "zod";
import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { buyWithCoins } from "@/server/game/service";

const body = z.object({ itemId: z.string().min(1).max(64) });

/** POST /api/game/shop/coins - acquisto con le monete */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  return buyWithCoins(player.id, body.parse(await request.json()).itemId);
});
