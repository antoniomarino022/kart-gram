import { NextResponse } from "next/server";
import { db } from "@/db";
import { items } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { loadItems } from "@/lib/game-helpers";
import { handle, HttpError } from "@/lib/http";
import { createItemSchema } from "@/schemas/admin";
import { assertValidItem } from "./validation";

/**
 * GET /api/admin/items
 *
 * Restituisce l'elenco completo di tutti gli oggetti del catalogo (inclusi quelli disattivati
 * con `isActive = false`), ordinati per `sortOrder` e `id`.
 */
export const GET = handle(async (request: Request) => {
  await requireAdmin(request);
  return loadItems({ activeOnly: false });
});

/**
 * POST /api/admin/items
 *
 * Crea un nuovo oggetto nel catalogo (`kart`, `paint`, `wheels`, `trail`, `coin_pack`, `starter_pack`).
 * Verifica prima le regole di coerenza prezzi/premi (`assertValidItem`) e l'unicità dello slug `id`.
 * Restituisce `201 Created` con la riga appena inserita, oppure `409 Conflict` se l'`id` esiste già.
 */
export const POST = handle(async (request: Request) => {
  await requireAdmin(request);

  const data = createItemSchema.parse(await request.json());
  await assertValidItem(data, data.grants);

  const [created] = await db
    .insert(items)
    .values(data)
    .onConflictDoNothing()
    .returning();

  if (!created) {
    throw new HttpError(409, `Esiste già un oggetto con id "${data.id}"`);
  }

  return NextResponse.json(created, { status: 201 });
});
