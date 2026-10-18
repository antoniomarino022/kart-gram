import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { buyUpgrade } from "@/server/game/shop";
import { buyUpgradeBodySchema } from "@/schemas/game";

/** POST /api/game/upgrades - livello successivo di un potenziamento */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { upgradeId } = buyUpgradeBodySchema.parse(await request.json());
  return buyUpgrade(player.id, upgradeId);
});
