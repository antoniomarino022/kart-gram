import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_CATALOG } from "@/backend/catalog";
import type { ItemRow } from "@/types/game";
import { isFree, toCatalogItem } from "./catalog";

const row = (i: (typeof DEFAULT_CATALOG)[number], n: number): ItemRow => ({
  id: i.id,
  kind: i.kind,
  name: i.name,
  priceCoins: i.priceCoins ?? null,
  priceStars: i.priceStars ?? null,
  model: i.model ?? null,
  color: i.color ?? null,
  finish: i.finish ?? null,
  coins: i.coins ?? null,
  revives: i.revives ?? null,
  grants: i.grants ?? null,
  sortOrder: n * 10,
  isActive: true,
  createdAt: new Date(0),
});

describe("catalogo dal DB", () => {
  it("una riga del DB torna identica all'oggetto del client", () => {
    DEFAULT_CATALOG.forEach((item, n) => expect(toCatalogItem(row(item, n))).toEqual(item));
  });

  it("gratis = 0 monete e non venduto in Stelle, come i posseduti iniziali del mock", () => {
    const free = DEFAULT_CATALOG.map(row).filter(isFree).map((r) => r.id);
    expect(free).toEqual(DEFAULT_CATALOG.filter((i) => i.priceCoins === 0).map((i) => i.id));
  });

  it("la migrazione di seed contiene tutto il catalogo del client", () => {
    const seed = readFileSync("drizzle/0004_seed_items.sql", "utf8");
    for (const item of DEFAULT_CATALOG) expect(seed).toContain(`('${item.id}', '${item.kind}'`);
  });
});
