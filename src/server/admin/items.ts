import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, playerItems, starPayments } from "@/db/schema";
import { HttpError } from "@/server/http";
import type { CreateItemInput, ItemRules, UpdateItemInput } from "@/types/admin";

/**
 * Combinazioni che il gioco non sa gestire o che creano monete dal nulla:
 * i pacchetti di monete si comprano solo in Stelle e danno monete, monete/revive/regali solo nei pacchetti.
 * Va applicata all'oggetto completo (dopo aver unito la modifica alla riga esistente).
 */
export function itemProblems(item: ItemRules): string | null {
  const isPack = item.kind === "coin_pack" || item.kind === "starter_pack";
  const hasPackRewards = item.coins != null || item.revives != null || item.grants != null;

  if (item.kind === "coin_pack" && (item.priceCoins != null || !item.priceStars || !item.coins)) {
    return "Un pacchetto di monete ha solo prezzo in Stelle e monete > 0";
  }

  if (!isPack && hasPackRewards) {
    return "Monete, revive e oggetti regalati valgono solo per i pacchetti";
  }

  if (item.kind === "coin_pack" && (item.revives != null || item.grants != null)) {
    return "Revive e oggetti regalati valgono solo per lo starter pack";
  }

  if (item.kind === "starter_pack" && item.priceCoins != null) {
    return "Lo starter pack si compra solo in Stelle";
  }

  if (item.priceCoins == null && item.priceStars == null) {
    return "Serve almeno un prezzo (monete o Stelle)";
  }

  return null;
}

/** Gli oggetti regalati da uno starter pack devono esistere, altrimenti la consegna fallirebbe dopo il pagamento. */
export async function checkGrants(grants: string[] | null | undefined): Promise<string | null> {
  if (!grants?.length) {
    return null;
  }

  const found = await db
    .select({ id: items.id })
    .from(items)
    .where(inArray(items.id, grants));

  const foundIds = new Set(found.map((row) => row.id));
  const missing = grants.filter((grantId) => !foundIds.has(grantId));

  return missing.length > 0
    ? `Oggetti regalati inesistenti: ${missing.join(", ")}`
    : null;
}

async function assertValidItem(item: ItemRules, grantsToVerify?: string[] | null): Promise<void> {
  const problem = itemProblems(item) ?? (await checkGrants(grantsToVerify));
  if (problem) {
    throw new HttpError(400, problem);
  }
}

export async function createItem(data: CreateItemInput) {
  await assertValidItem(data, data.grants);

  const [row] = await db
    .insert(items)
    .values(data)
    .onConflictDoNothing()
    .returning();

  if (!row) {
    throw new HttpError(409, `Esiste già un oggetto con id "${data.id}"`);
  }

  return row;
}

/** Modifica (anche parziale): le regole si controllano sull'oggetto risultante. */
export async function updateItem(id: string, data: UpdateItemInput) {
  const [current] = await db
    .select()
    .from(items)
    .where(eq(items.id, id))
    .limit(1);

  if (!current) {
    throw new HttpError(404, "Oggetto non trovato");
  }

  await assertValidItem({ ...current, ...data }, data.grants);

  const [row] = await db
    .update(items)
    .set(data)
    .where(eq(items.id, id))
    .returning();

  return row;
}

/** Eliminazione solo se nessuno lo possiede, l'ha pagato o lo riceve in un pacchetto; altrimenti va disattivato. */
export async function deleteItem(id: string) {
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

  const [row] = await db
    .delete(items)
    .where(eq(items.id, id))
    .returning({ id: items.id });

  if (!row) {
    throw new HttpError(404, "Oggetto non trovato");
  }

  return { ok: true };
}
