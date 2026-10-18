import { z } from "zod";
import { HttpError } from "@/server/http";

export type RunContext = { params: Promise<{ id: string }> };

/** Id partita dall'URL: un uuid, altrimenti 404 (le partite locali del client non arrivano al server). */
export async function runIdFrom(context: RunContext): Promise<string> {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(404, "Partita non trovata");
  return id;
}
