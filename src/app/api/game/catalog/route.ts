import { requirePlayer } from "@/lib/auth";
import { toCatalogItem } from "@/lib/constants";
import { loadItems } from "@/lib/game-helpers";
import { handle } from "@/lib/http";
import { redis, withRedisTimeout } from "@/lib/redis";
import type { CatalogItem } from "@/types/game";

const CATALOG_CACHE_KEY = "cache:catalog:active";
const CATALOG_CACHE_TTL = 300; // 5 minuti

// Cache in-memory del processo locale Node per risposta a 0ms (sub-millisecondo)
let localCatalogCache: { data: CatalogItem[]; expiresAt: number } | null = null;

/**
 * GET /api/game/catalog
 *
 * Restituisce gli oggetti attivi del catalogo per Garage e Shop.
 * Priorità:
 * 1. Cache locale RAM Node (0ms)
 * 2. Cache Redis (con timeout ultra-rapido a 150ms)
 * 3. Database Postgres Neon (con aggiornamento asincrono in background)
 */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);

  // 1. Cache locale RAM del processo (istantanea)
  if (localCatalogCache && Date.now() < localCatalogCache.expiresAt) {
    return localCatalogCache.data;
  }

  // 2. Cache Redis con timeout a 150ms max
  const redisCached = await withRedisTimeout(
    redis.get<CatalogItem[]>(CATALOG_CACHE_KEY),
    150
  );

  if (redisCached && Array.isArray(redisCached) && redisCached.length > 0) {
    localCatalogCache = { data: redisCached, expiresAt: Date.now() + 60_000 };
    return redisCached;
  }

  // 3. Database Postgres Neon
  const activeItems = await loadItems({ activeOnly: true });
  const catalog = activeItems.map(toCatalogItem);

  localCatalogCache = { data: catalog, expiresAt: Date.now() + 60_000 };

  // Salvataggio Redis in background asincrono (non aspetta la risposta, 0 overhead per l'utente)
  void redis.set(CATALOG_CACHE_KEY, catalog, { ex: CATALOG_CACHE_TTL }).catch(() => {});

  return catalog;
});
