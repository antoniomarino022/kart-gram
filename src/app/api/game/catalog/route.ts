import { requirePlayer } from "@/lib/auth";
import { toCatalogItem } from "@/lib/constants";
import { loadItems } from "@/lib/game-helpers";
import { handle } from "@/lib/http";
import { redis } from "@/lib/redis";
import type { CatalogItem } from "@/types/game";

const CATALOG_CACHE_KEY = "cache:catalog:active";
const CATALOG_CACHE_TTL = 300; // 5 minuti

/**
 * GET /api/game/catalog
 *
 * Restituisce tutti gli oggetti attivi (`isActive = true`) del catalogo per Garage e Shop.
 * I risultati vengono salvati in cache su Redis per 5 minuti.
 */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);

  try {
    const cached = await redis.get<CatalogItem[]>(CATALOG_CACHE_KEY);
    if (cached) {
      return cached;
    }
  } catch (err) {
    console.error("Redis catalog cache error, fallback to DB:", err);
  }

  const activeItems = await loadItems({ activeOnly: true });
  const catalog = activeItems.map(toCatalogItem);

  try {
    await redis.set(CATALOG_CACHE_KEY, catalog, { ex: CATALOG_CACHE_TTL });
  } catch (err) {
    console.error("Redis set catalog error:", err);
  }

  return catalog;
});
