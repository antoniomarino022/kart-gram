import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { finishRun } from "@/server/game/service";
import { runIdFrom, type RunContext } from "../params";

// replay di una partita lunga + attesa del webhook di un revive in Stelle
export const maxDuration = 30;

/** POST /api/game/runs/:id/finish - chiude la partita; punteggio e monete li ricalcola il server */
export const POST = handle(async (request: Request, context: RunContext) => {
  const player = await requirePlayer(request);
  return finishRun(player.id, await runIdFrom(context), await request.json());
});
