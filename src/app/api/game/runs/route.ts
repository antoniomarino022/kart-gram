import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { startRun } from "@/server/game/service";

/** POST /api/game/runs - nuova partita: restituisce runId e seed */
export const POST = handle(async (request: Request) => startRun((await requirePlayer(request)).id));
