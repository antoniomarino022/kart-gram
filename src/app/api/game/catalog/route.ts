import { requirePlayer } from "@/lib/auth";
import { toCatalogItem } from "@/lib/constants";
import { loadItems } from "@/lib/game-helpers";
import { handle } from "@/lib/http";

/**
 * GET /api/game/catalog
 *
 * Restituisce tutti gli oggetti attivi (`isActive = true`) del catalogo per Garage e Shop:
 * kart, vernici, ruote, scie, pacchetti di monete (`coin_pack`) e `starter_pack`.
 * Gli oggetti sono ordinati per `sortOrder` crescente e convertiti nel formato client
 * (omettendo i campi `null`).
 */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);

  const activeItems = await loadItems({ activeOnly: true });
  return activeItems.map(toCatalogItem);
});
