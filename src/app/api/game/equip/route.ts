import { z } from "zod";
import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { equip } from "@/server/game/service";

const body = z.object({ slot: z.enum(["kart", "paint", "wheels", "trail"]), itemId: z.string().min(1).max(64) });

/** POST /api/game/equip - equipaggia un oggetto posseduto */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { slot, itemId } = body.parse(await request.json());
  return equip(player.id, slot, itemId);
});
