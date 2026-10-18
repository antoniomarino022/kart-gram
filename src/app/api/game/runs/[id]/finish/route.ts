import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { finishRun } from "@/server/game/runs";
import { finishRunBodySchema } from "@/schemas/game";
import type { IdParamContext } from "@/types/game";
import { runIdFrom } from "../params";

// Replay di una partita lunga + attesa del webhook di un revive in Stelle
export const maxDuration = 30;

/** POST /api/game/runs/:id/finish - chiude la partita; punteggio e monete li ricalcola il server */
export const POST = handle(async (request: Request, context: IdParamContext) => {
  const player = await requirePlayer(request);
  const runId = await runIdFrom(context);
  const body = finishRunBodySchema.parse(await request.json());
  return finishRun(player.id, runId, body);
});
