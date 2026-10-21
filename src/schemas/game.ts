import { z } from "zod";
import { CONFIG } from "@/game/core/config";

// ---------------------------------------------------------------------------
// Validazione delle richieste di /api/game
// ---------------------------------------------------------------------------

export const slotSchema = z.enum(["kart", "paint", "wheels", "trail"]);
export const itemIdSchema = z.string().min(1).max(64);
export const runIdSchema = z.uuid();

export const equipBodySchema = z.object({ slot: slotSchema, itemId: itemIdSchema });

export const buyItemBodySchema = z.object({ itemId: itemIdSchema });

export const buyUpgradeBodySchema = z.object({ upgradeId: z.string().min(1).max(20) });

export const reviveBodySchema = z.object({ pay: z.enum(['coins', 'stars', 'owned', 'ad']) });

export const finishRunBodySchema = z.object({
  // oltre la durata massima di una partita si rigioca solo fino a lì (il client non ha un tetto)
  ticks: z.number().int().min(0).transform((t) => Math.min(t, CONFIG.maxTicks)),
  revived: z.boolean().optional(),
  inputs: z.array(z.tuple([z.number().int().min(0), z.union([z.literal(-1), z.literal(0), z.literal(1)])])).max(50_000),
});
