import { HttpError } from "@/server/http";
import { runIdSchema } from "@/schemas/game";
import type { IdParamContext } from "@/types/game";

/** Id partita dall'URL: un uuid, altrimenti 404 (le partite locali del client non arrivano al server). */
export async function runIdFrom(context: IdParamContext): Promise<string> {
  const { id } = await context.params;

  if (!runIdSchema.safeParse(id).success) {
    throw new HttpError(404, "Partita non trovata");
  }

  return id;
}
