import { HttpError } from "@/server/http";
import type { IdParamContext } from "@/types/game";

export async function playerIdFrom(context: IdParamContext): Promise<number> {
  const { id } = await context.params;
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new HttpError(404, "Giocatore non trovato");
  }

  return parsedId;
}
