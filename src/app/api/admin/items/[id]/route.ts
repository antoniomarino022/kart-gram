import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, playerItems, starPayments } from "@/db/schema";
import { handle, HttpError } from "@/server/http";
import { requireAdmin } from "@/server/admin";
import { itemProblems, updateItemSchema } from "@/server/admin-items";
import { checkGrants } from "@/server/admin-grants";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/admin/items/:id - modifica (anche parziale) */
export const PUT = handle(async (request: Request, context: Ctx) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const data = updateItemSchema.parse(await request.json());
  const [current] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!current) throw new HttpError(404, "Oggetto non trovato");
  const merged = { ...current, ...data };
  const problem = itemProblems({ ...merged, kind: merged.kind as never, finish: merged.finish as never }) ?? (await checkGrants(data.grants));
  if (problem) throw new HttpError(400, problem);
  const [row] = await db.update(items).set(data).where(eq(items.id, id)).returning();
  return row;
});

/** DELETE /api/admin/items/:id - solo se nessuno lo possiede o l'ha pagato; altrimenti va disattivato */
export const DELETE = handle(async (request: Request, context: Ctx) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const [owned] = await db.select({ id: playerItems.itemId }).from(playerItems).where(eq(playerItems.itemId, id)).limit(1);
  const [paid] = await db.select({ id: starPayments.id }).from(starPayments).where(eq(starPayments.itemId, id)).limit(1);
  if (owned || paid) throw new HttpError(409, "Oggetto già posseduto o pagato da qualcuno: disattivalo invece di eliminarlo");
  const [inPack] = await db.select({ id: items.id }).from(items).where(sql`${items.grants} @> ${JSON.stringify([id])}::jsonb`).limit(1);
  if (inPack) throw new HttpError(409, `Oggetto regalato da "${inPack.id}": toglilo prima da lì`);
  const [row] = await db.delete(items).where(eq(items.id, id)).returning({ id: items.id });
  if (!row) throw new HttpError(404, "Oggetto non trovato");
  return { ok: true };
});
