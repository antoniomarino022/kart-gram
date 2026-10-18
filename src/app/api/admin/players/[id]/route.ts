import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { playerDetail, updatePlayer } from "@/server/admin/players";
import { updatePlayerSchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";
import { playerIdFrom } from "./params";

/** GET /api/admin/players/:id - scheda giocatore: oggetti, potenziamenti, partite, pagamenti, movimenti di monete */
export const GET = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);
  const playerId = await playerIdFrom(context);
  return playerDetail(playerId);
});

/** PATCH /api/admin/players/:id - monete, revive, nome, sospensione */
export const PATCH = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);
  const playerId = await playerIdFrom(context);
  const data = updatePlayerSchema.parse(await request.json());
  return updatePlayer(playerId, data);
});
