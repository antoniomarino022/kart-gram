import { z } from "zod";
import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { watchAd, getMilestones } from "@/server/game/service";

const body = z.object({
  itemId: z.string().min(1).max(64).optional(),
  providerRef: z.string().max(255).optional(),
});

/** POST /api/game/ads/watch - registra la visione di un annuncio (monete bonus o progresso sblocco) */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const data = body.parse(await request.json().catch(() => ({})));
  return watchAd(player.id, data);
});

/** GET /api/game/ads/watch - recupera statistiche e milestone (ads viste, referral) */
export const GET = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  return getMilestones(player.id);
});
