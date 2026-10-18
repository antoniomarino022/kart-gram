import type { CatalogItem, ItemRow, Slot } from "@/types/game";

export const UPGRADE_COSTS = [200, 500, 1000, 2000, 4000] as const;
export const MAX_UPGRADE_LEVEL = 5;
export const REVIVE_PRICE = { coins: 500, stars: 5 } as const;
export const PAGE_SIZE = 50;

export const SLOTS: readonly Slot[] = ["kart", "paint", "wheels", "trail"];

export const DEFAULT_EQUIPPED: Record<Slot, string> = {
  kart: "kart_classic",
  paint: "paint_red",
  wheels: "wheel_basic",
  trail: "trail_smoke",
};

const paint = (
  id: string,
  name: string,
  color: string,
  priceCoins?: number,
  finish: CatalogItem["finish"] = "flat",
  priceStars?: number,
): CatalogItem => ({
  id,
  kind: "paint",
  name,
  color,
  finish,
  priceCoins,
  priceStars,
});

export const DEFAULT_CATALOG: CatalogItem[] = [
  { id: "kart_classic", kind: "kart", name: "Classic", model: "kart_classic.glb", priceCoins: 0 },
  { id: "kart_bolt", kind: "kart", name: "Bolt", model: "kart_bolt.glb", priceCoins: 1000 },
  { id: "kart_brick", kind: "kart", name: "Brick", model: "kart_brick.glb", priceCoins: 3000, priceStars: 25 },
  { id: "kart_rocket", kind: "kart", name: "Rocket", model: "kart_rocket.glb", priceStars: 150 },

  paint("paint_red", "Rosso", "#e63946", 0),
  paint("paint_yellow", "Giallo", "#ffd23f", 300),
  paint("paint_blue", "Blu", "#3a86ff", 300),
  paint("paint_green", "Verde", "#2dc653", 300),
  paint("paint_purple", "Viola", "#8338ec", 300),
  paint("paint_orange", "Arancione", "#fb8500", 300),
  paint("paint_white", "Bianco", "#f1f1f1", 300),
  paint("paint_black", "Nero", "#222222", 300),
  paint("paint_metal", "Metal", "#b8c4cc", 300, "metal"),
  paint("paint_neon", "Neon", "#39ff14", undefined, "neon", 15),

  { id: "wheel_basic", kind: "wheels", name: "Base", model: "wheel_basic.glb", priceCoins: 0 },
  { id: "wheel_sport", kind: "wheels", name: "Sport", model: "wheel_sport.glb", priceCoins: 500 },
  { id: "wheel_offroad", kind: "wheels", name: "Offroad", model: "wheel_offroad.glb", priceCoins: 500 },
  { id: "wheel_retro", kind: "wheels", name: "Retro", model: "wheel_retro.glb", priceCoins: 500 },

  { id: "trail_smoke", kind: "trail", name: "Fumo", color: "#d9d9d9", priceCoins: 0 },
  { id: "trail_fire", kind: "trail", name: "Fiamme", color: "#ff6b1a", priceCoins: 800 },
  { id: "trail_rainbow", kind: "trail", name: "Arcobaleno", color: "#ff00ff", priceStars: 20 },
  { id: "trail_stars", kind: "trail", name: "Stelle", color: "#ffe14d", priceStars: 30 },

  { id: "coins_s", kind: "coin_pack", name: "Sacchetto di monete", coins: 2500, priceStars: 50 },
  { id: "coins_m", kind: "coin_pack", name: "Forziere di monete", coins: 15000, priceStars: 250 },
  { id: "coins_l", kind: "coin_pack", name: "Caveau di monete", coins: 35000, priceStars: 500 },
  { id: "starter_pack", kind: "starter_pack", name: "Starter Pack", priceStars: 49, coins: 2000, revives: 3, grants: ["kart_brick"] },
];

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
