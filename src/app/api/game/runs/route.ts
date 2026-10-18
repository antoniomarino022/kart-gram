import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { startRun } from "@/server/game/runs";

/** POST /api/game/runs - nuova partita: restituisce runId e seed */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  return startRun(player.id);
});
