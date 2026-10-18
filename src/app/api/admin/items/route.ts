import { db } from "@/db";
import { items } from "@/db/schema";
import { handle, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { createItemSchema, itemProblems } from "@/server/admin-items";
import { checkGrants } from "@/server/admin-grants";
import { loadItems } from "@/server/game/catalog";

/** GET /api/admin/items - tutto il catalogo, anche gli oggetti disattivati */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  return loadItems({ activeOnly: false });
});

/** POST /api/admin/items - nuovo oggetto */
export const POST = handle(async (request: Request) => {
  await requireAdmin(request);
  const data = createItemSchema.parse(await request.json());
  const problem = itemProblems(data) ?? (await checkGrants(data.grants));
  if (problem) throw new HttpError(400, problem);
  const [row] = await db.insert(items).values(data).onConflictDoNothing().returning();
  if (!row) throw new HttpError(409, `Esiste già un oggetto con id "${data.id}"`);
  return row;
});
