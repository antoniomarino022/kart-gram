import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, playerItems } from "@/db/schema";
import type { CatalogItem } from "@/backend/types";
import { bad } from "@/server/http";
import type { DbClient, ItemRow } from "@/types/game";

/** Riga del DB → oggetto del catalogo nel formato del client (i null diventano campi assenti). */
export function toCatalogItem(row: ItemRow): CatalogItem {
  const item: CatalogItem = {
    id: row.id,
    kind: row.kind as CatalogItem["kind"],
    name: row.name,
  };

  if (row.priceCoins !== null) item.priceCoins = row.priceCoins;
  if (row.priceStars !== null) item.priceStars = row.priceStars;
  if (row.model) item.model = row.model;
  if (row.color) item.color = row.color;
  if (row.finish) item.finish = row.finish as CatalogItem["finish"];
  if (row.coins !== null) item.coins = row.coins;
  if (row.revives !== null) item.revives = row.revives;
  if (row.grants?.length) item.grants = row.grants;

  return item;
}

/** Oggetti posseduti da tutti: gratis in monete e non venduti in Stelle. */
export function isFree(row: Pick<ItemRow, "priceCoins" | "priceStars">): boolean {
  return row.priceCoins === 0 && row.priceStars === null;
}

export async function loadItems(opts: { activeOnly: boolean }): Promise<ItemRow[]> {
  const query = db.select().from(items);
  const filtered = opts.activeOnly ? query.where(eq(items.isActive, true)) : query;

  return filtered.orderBy(asc(items.sortOrder), asc(items.id));
}

export async function loadCatalog(): Promise<CatalogItem[]> {
  const activeItems = await loadItems({ activeOnly: true });
  return activeItems.map(toCatalogItem);
}

/** Oggetto attivo del catalogo, altrimenti 400. */
export async function activeItem(client: DbClient, itemId: string): Promise<ItemRow> {
  const [item] = await client
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.isActive, true)))
    .limit(1);

  if (!item) {
    throw bad("Oggetto sconosciuto");
  }

  return item;
}

/** Il giocatore possiede l'oggetto (gli oggetti gratuiti li possiedono tutti). */
export async function owns(client: DbClient, userId: number, item: ItemRow): Promise<boolean> {
  if (isFree(item)) {
    return true;
  }

  const [row] = await client
    .select()
    .from(playerItems)
    .where(and(eq(playerItems.userId, userId), eq(playerItems.itemId, item.id)))
    .limit(1);

  return Boolean(row);
}
