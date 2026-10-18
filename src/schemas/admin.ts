import { z } from "zod";
import { itemIdSchema } from "./game";

// ---------------------------------------------------------------------------
// Validazione delle richieste di /api/admin
// ---------------------------------------------------------------------------

export const ITEM_KINDS = ["kart", "paint", "wheels", "trail", "coin_pack", "starter_pack"] as const;

/** Campi modificabili di un oggetto del catalogo (null = campo non usato). Nessun default: un aggiornamento parziale non tocca il resto. */
export const itemFieldsSchema = z.object({
  kind: z.enum(ITEM_KINDS),
  name: z.string().trim().min(1).max(100),
  priceCoins: z.number().int().min(0).nullable(),
  priceStars: z.number().int().min(1).nullable(),
  model: z.string().trim().max(100).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colore esadecimale, es. #ffd60a").nullable(),
  finish: z.enum(["flat", "metal", "neon"]).nullable(),
  coins: z.number().int().min(0).nullable(),
  revives: z.number().int().min(0).nullable(),
  grants: z.array(z.string().min(1).max(64)).nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
});

export const createItemSchema = itemFieldsSchema
  .partial()
  .required({ kind: true, name: true })
  .extend({ id: z.string().regex(/^[a-z0-9_]{2,64}$/, "Solo lettere minuscole, numeri e _ (es. kart_bolt)") });

export const updateItemSchema = itemFieldsSchema.partial();

export const updatePlayerSchema = z.object({
  coins: z.number().int().min(0).max(1_000_000_000).optional(),
  revives: z.number().int().min(0).max(10_000).optional(),
  isBanned: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(100).optional(),
});

export const grantItemBodySchema = z.object({ itemId: itemIdSchema });
