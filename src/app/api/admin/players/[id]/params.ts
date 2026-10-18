import { HttpError } from "@/server/http";

export async function playerIdFrom(context: { params: Promise<{ id: string }> }): Promise<number> {
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, "Giocatore non trovato");
  return id;
}
