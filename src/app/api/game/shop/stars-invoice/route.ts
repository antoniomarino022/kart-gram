import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { createStarsInvoice } from "@/server/game/shop";
import { buyItemBodySchema } from "@/schemas/game";

/** POST /api/game/shop/stars-invoice - fattura in Stelle; l'oggetto arriva col webhook successful_payment */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { itemId } = buyItemBodySchema.parse(await request.json());
  return createStarsInvoice(player.id, itemId);
});
