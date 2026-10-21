import { requirePlayer } from "@/lib/auth";
import { handle } from "@/lib/http";

/**
 * GET /api/game/ads/config
 *
 * Restituisce in modo sicuro la configurazione Adsgram al client autenticato,
 * leggendo la variabile d'ambiente ADSGRAM_BLOCK_ID o NEXT_PUBLIC_ADSGRAM_BLOCK_ID dal server.
 */
export const GET = handle(async (request: Request) => {
  await requirePlayer(request);

  const blockId = (
    process.env.ADSGRAM_BLOCK_ID ||
    process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID ||
    ""
  ).trim();

  return {
    blockId,
  };
});
