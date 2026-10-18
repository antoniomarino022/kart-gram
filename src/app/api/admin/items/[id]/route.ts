import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, playerItems, starPayments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
import { updateItemSchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";
import { assertValidItem } from "../validation";

/**
 * PATCH /api/admin/items/:id
 *
 * Aggiorna parzialmente un oggetto esistente del catalogo (es. cambio prezzo, nome, `isActive`, `sortOrder`).
 * Valida la combinazione finale unendo i campi esistenti con quelli modificati (`{ ...current, ...data }`).
 */
export const PATCH = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);

  const { id } = await context.params;
  const data = updateItemSchema.parse(await request.json());

  const [current] = await db
    .select()
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!current) {
    throw new HttpError(404, "Oggetto non trovato");
  }

  await assertValidItem({ ...current, ...data }, data.grants);

  const [updated] = await db
    .update(items)
    .set(data)
    .where(eq(items.id, id))
    .returning();

  return updated;
});

/**
 * DELETE /api/admin/items/:id
 *
 * Elimina definitivamente un oggetto dal catalogo SOLO se:
 * - nessun giocatore lo possiede in `Player_Items`;
 * - non esistono transazioni in `Star_Payments` associate;
 * - non è incluso nella lista `grants` di uno `starter_pack`.
 *
 * Se l'oggetto è già stato acquistato o usato, risponde `409 Conflict` suggerendo di disattivarlo (`isActive = false`).
 */
export const DELETE = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);

  const { id } = await context.params;

  const [[owned], [paid], [inPack]] = await Promise.all([
    db
      .select({ id: playerItems.itemId })
      .from(playerItems)
      .where(eq(playerItems.itemId, id))
      .limit(1),
    db
      .select({ id: starPayments.id })
      .from(starPayments)
      .where(eq(starPayments.itemId, id))
      .limit(1),
    db
      .select({ id: items.id })
      .from(items)
      .where(sql`${items.grants} @> ${JSON.stringify([id])}::jsonb`)
      .limit(1),
  ]);

  if (owned || paid) {
    throw new HttpError(
      409,
      "Oggetto già posseduto o pagato da qualcuno: disattivalo invece di eliminarlo",
    );
  }

  if (inPack) {
    throw new HttpError(409, `Oggetto regalato da "${inPack.id}": toglilo prima da lì`);
  }

  const [deleted] = await db
    .delete(items)
    .where(eq(items.id, id))
    .returning({ id: items.id });

  if (!deleted) {
    throw new HttpError(404, "Oggetto non trovato");
  }

  return { ok: true };
});
