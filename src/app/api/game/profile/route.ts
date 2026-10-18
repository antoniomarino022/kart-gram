import { requirePlayer } from "@/lib/auth";
import { buildProfile } from "@/lib/game-helpers";
import { handle } from "@/lib/http";

/**
 * GET /api/game/profile
 *
 * Restituisce il profilo completo del giocatore autenticato tramite Telegram Mini App:
 * - saldo monete, record personale (bestScore) e revive disponibili;
 * - elenco ID degli oggetti posseduti (inclusi quelli gratuiti di default);
 * - equipaggiamento attivo per ogni slot (kart, paint, wheels, trail);
 * - livelli attuali dei potenziamenti (turbo, magnet, slowmo, x2).
 *
 * Se il giocatore apre la Mini App per la prima volta senza aver usato /start nel bot,
 * `requirePlayer` crea automaticamente il suo profilo nel database.
 */
export const GET = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  return buildProfile(player.id);
});
