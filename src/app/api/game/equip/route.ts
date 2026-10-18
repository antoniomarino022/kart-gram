import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { equip } from "@/server/game/shop";
import { equipBodySchema } from "@/schemas/game";

/** POST /api/game/equip - equipaggia un oggetto posseduto */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { slot, itemId } = equipBodySchema.parse(await request.json());
  return equip(player.id, slot, itemId);
});
