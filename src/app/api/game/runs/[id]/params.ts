import { HttpError } from "@/lib/http";
import { runIdSchema } from "@/schemas/game";
import type { IdParamContext } from "@/types/game";

/**
 * Estrae e valida l'UUID `:id` della partita dai parametri della rotta (`/api/game/runs/[id]/*`).
 * Lancia 404 se l'ID non è un UUID valido.
 */
export async function parseRunId(context: IdParamContext): Promise<string> {
  const { id } = await context.params;
  const parsed = runIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new HttpError(404, "Partita non trovata");
  }

  return parsed.data;
}
