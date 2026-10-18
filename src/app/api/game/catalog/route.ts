import { handle } from "@/server/http";
import { requirePlayer } from "@/server/game/player";
import { loadCatalog } from "@/server/game/catalog";

/** GET /api/game/catalog - oggetti attivi del negozio e del garage */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);
  return loadCatalog();
});
