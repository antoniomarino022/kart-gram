import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { buildProfile } from "@/server/game/profile";

/** GET /api/game/profile - profilo del giocatore autenticato con Telegram */
export const GET = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  return buildProfile(player.id);
});
