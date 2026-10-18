import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import type { CatalogItem } from "@/backend/types";

export type ItemRow = typeof items.$inferSelect;

/** Riga del DB → oggetto del catalogo nel formato del client (i null diventano campi assenti). */
export function toCatalogItem(r: ItemRow): CatalogItem {
  const item: CatalogItem = { id: r.id, kind: r.kind as CatalogItem["kind"], name: r.name };
  if (r.priceCoins !== null) item.priceCoins = r.priceCoins;
  if (r.priceStars !== null) item.priceStars = r.priceStars;
  if (r.model) item.model = r.model;
  if (r.color) item.color = r.color;
  if (r.finish) item.finish = r.finish as CatalogItem["finish"];
  if (r.coins !== null) item.coins = r.coins;
  if (r.revives !== null) item.revives = r.revives;
  if (r.grants?.length) item.grants = r.grants;
  return item;
}

/** Oggetti posseduti da tutti: gratis in monete e non venduti in Stelle. */
export const isFree = (r: Pick<ItemRow, "priceCoins" | "priceStars">) => r.priceCoins === 0 && r.priceStars === null;

export async function loadItems(opts: { activeOnly: boolean }): Promise<ItemRow[]> {
  const q = db.select().from(items);
  return (opts.activeOnly ? q.where(eq(items.isActive, true)) : q).orderBy(asc(items.sortOrder), asc(items.id));
}

export async function loadCatalog(): Promise<CatalogItem[]> {
  return (await loadItems({ activeOnly: true })).map(toCatalogItem);
}
