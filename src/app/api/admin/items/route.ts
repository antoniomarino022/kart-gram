import { handle } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { createItem } from "@/server/admin/items";
import { loadItems } from "@/server/game/catalog";
import { createItemSchema } from "@/schemas/admin";

/** GET /api/admin/items - tutto il catalogo, anche gli oggetti disattivati */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  return loadItems({ activeOnly: false });
});

/** POST /api/admin/items - nuovo oggetto */
export const POST = handle(async (request: Request) => {
  await requireAdmin(request);
  const data = createItemSchema.parse(await request.json());
  return createItem(data);
});
