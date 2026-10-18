import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { buyWithCoins } from "@/server/game/shop";
import { buyItemBodySchema } from "@/schemas/game";

/** POST /api/game/shop/coins - acquisto con le monete */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { itemId } = buyItemBodySchema.parse(await request.json());
  return buyWithCoins(player.id, itemId);
});
