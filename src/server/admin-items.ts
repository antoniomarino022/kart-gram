import { z } from "zod";

const KINDS = ["kart", "paint", "wheels", "trail", "coin_pack", "starter_pack"] as const;

/** Campi modificabili di un oggetto del catalogo (null = campo non usato). Nessun default: un aggiornamento parziale non tocca il resto. */
export const itemFields = z.object({
  kind: z.enum(KINDS),
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

type ItemFields = Partial<z.infer<typeof itemFields>>;

/**
 * Combinazioni che il gioco non sa gestire o che creano monete dal nulla:
 * i pacchetti di monete si comprano solo in Stelle e danno monete, monete/revive/regali solo nei pacchetti.
 * Va applicata all'oggetto completo (dopo aver unito la modifica alla riga esistente).
 */
export function itemProblems(i: ItemFields): string | null {
  const pack = i.kind === "coin_pack" || i.kind === "starter_pack";
  if (i.kind === "coin_pack" && (i.priceCoins != null || !i.priceStars || !i.coins)) return "Un pacchetto di monete ha solo prezzo in Stelle e monete > 0";
  if (!pack && (i.coins != null || i.revives != null || i.grants != null)) return "Monete, revive e oggetti regalati valgono solo per i pacchetti";
  if (i.kind === "coin_pack" && (i.revives != null || i.grants != null)) return "Revive e oggetti regalati valgono solo per lo starter pack";
  if (i.kind === "starter_pack" && i.priceCoins != null) return "Lo starter pack si compra solo in Stelle";
  if (i.priceCoins == null && i.priceStars == null) return "Serve almeno un prezzo (monete o Stelle)";
  return null;
}

export const createItemSchema = itemFields
  .partial()
  .required({ kind: true, name: true })
  .extend({ id: z.string().regex(/^[a-z0-9_]{2,64}$/, "Solo lettere minuscole, numeri e _ (es. kart_bolt)") });

export const updateItemSchema = itemFields.partial();
