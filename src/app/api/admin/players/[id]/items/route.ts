import { eq } from "drizzle-orm";
import { withTx } from "@/db";
import { items } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { grantItem, lockPlayer } from "@/lib/game-helpers";
import { handle, HttpError } from "@/lib/http";
import { grantItemBodySchema } from "@/schemas/admin";
import type { IdParamContext } from "@/types/game";
import { loadPlayerDetail, parsePlayerId } from "../params";

/**
 * POST /api/admin/players/:id/items
 *
 * Regala/assegna manualmente un oggetto del catalogo al giocatore con `source = "admin"`.
 * Body: `{ itemId: string }`
 * Se l'oggetto assegnato è un `coin_pack` o `starter_pack`, accredita anche le relative monete/revive.
 * Restituisce il dettaglio giocatore aggiornato.
 */
export const POST = handle(async (request: Request, context: IdParamContext) => {
  await requireAdmin(request);

  const playerId = await parsePlayerId(context);
  const { itemId } = grantItemBodySchema.parse(await request.json());

  await withTx(async (tx) => {
    await lockPlayer(tx, playerId);

    const [item] = await tx
      .select()
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item) {
      throw new HttpError(400, "Oggetto sconosciuto");
    }

    await grantItem(tx, playerId, item, "admin");
  });

  return loadPlayerDetail(playerId);
});
