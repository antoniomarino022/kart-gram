import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { deleteItem, updateItem } from "@/server/admin/items";
import { updateItemSchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";

/** PUT /api/admin/items/:id - modifica (anche parziale) */
export const PUT = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const data = updateItemSchema.parse(await request.json());
  return updateItem(id, data);
});

/** DELETE /api/admin/items/:id - solo se nessuno lo possiede o l'ha pagato; altrimenti va disattivato */
export const DELETE = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return deleteItem(id);
});
