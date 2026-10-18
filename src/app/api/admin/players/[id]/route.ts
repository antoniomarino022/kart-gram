import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { playerDetail, updatePlayer, updatePlayerSchema } from "@/server/admin-players";
import { playerIdFrom } from "./params";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/players/:id - scheda giocatore: oggetti, potenziamenti, partite, pagamenti, movimenti di monete */
export const GET = handle(async (request: Request, context: Ctx) => {
  await requireAdmin(request);
  return playerDetail(await playerIdFrom(context));
});

/** PATCH /api/admin/players/:id - monete, revive, nome, sospensione */
export const PATCH = handle(async (request: Request, context: Ctx) => {
  await requireAdmin(request);
  return updatePlayer(await playerIdFrom(context), updatePlayerSchema.parse(await request.json()));
});
