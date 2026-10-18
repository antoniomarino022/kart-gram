import { eq } from "drizzle-orm";
import { withTx } from "@/db";
import { telegramUsers } from "@/db/schema";
import { requirePlayer } from "@/lib/auth";
import { activeItem, buildProfile, lockPlayer, owns } from "@/lib/game-helpers";
import { bad, handle } from "@/lib/http";
import { equipBodySchema } from "@/schemas/game";

/**
 * POST /api/game/equip
 *
 * Equipaggia un oggetto cosmetico in uno dei 4 slot disponibili (`kart`, `paint`, `wheels`, `trail`).
 * Body: `{ slot: "kart" | "paint" | "wheels" | "trail", itemId: string }`
 *
 * Verifica in transazione che:
 * - l'oggetto esista, sia attivo e corrisponda allo slot richiesto;
 * - il giocatore possieda l'oggetto (o che sia gratuito di base);
 * - aggiorna la mappa JSON `equipped` dell'utente e restituisce il `Profile` aggiornato.
 */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { slot, itemId } = equipBodySchema.parse(await request.json());

  await withTx(async (tx) => {
    // Verifica che l'oggetto esista nel catalogo attivo e sia adatto allo slot
    const item = await activeItem(tx, itemId);
    if (item.kind !== slot) {
      throw bad("Oggetto non adatto a questo slot");
    }

    // Verifica che il giocatore lo possieda
    const isOwned = await owns(tx, player.id, item);
    if (!isOwned) {
      throw bad("Oggetto non posseduto");
    }

    // Blocca la riga del giocatore e aggiorna lo slot equipaggiato
    const locked = await lockPlayer(tx, player.id);

    await tx
      .update(telegramUsers)
      .set({ equipped: { ...locked.equipped, [slot]: itemId } })
      .where(eq(telegramUsers.id, player.id));
  });

  return buildProfile(player.id);
});
