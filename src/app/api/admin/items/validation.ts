import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { HttpError } from "@/lib/http";
import type { ItemRules } from "@/types/admin";

/**
 * Verifica la coerenza di un oggetto del catalogo prima di crearlo o aggiornarlo:
 * - I `coin_pack` si comprano solo in Stelle e devono accreditare `coins > 0`;
 * - `coins`, `revives` e `grants` sono ammessi solo nei pacchetti (`coin_pack` / `starter_pack`);
 * - Lo `starter_pack` si compra solo in Stelle;
 * - Ogni oggetto deve avere almeno un prezzo (`priceCoins` o `priceStars`).
 */
export function itemProblems(item: ItemRules): string | null {
  const isPack = item.kind === "coin_pack" || item.kind === "starter_pack";
  const hasPackRewards = item.coins != null || item.revives != null || item.grants != null;

  if (item.kind === "coin_pack" && (item.priceCoins != null || !item.priceStars || !item.coins)) {
    return "Un pacchetto di monete ha solo prezzo in Stelle e monete > 0";
  }

  if (!isPack && hasPackRewards) {
    return "Monete, revive e oggetti regalati valgono solo per i pacchetti";
  }

  if (item.kind === "coin_pack" && (item.revives != null || item.grants != null)) {
    return "Revive e oggetti regalati valgono solo per lo starter pack";
  }

  if (item.kind === "starter_pack" && item.priceCoins != null) {
    return "Lo starter pack si compra solo in Stelle";
  }

  if (item.priceCoins == null && item.priceStars == null) {
    return "Serve almeno un prezzo (monete o Stelle)";
  }

  return null;
}

/**
 * Controlla che tutti gli ID elencati in `grants` (oggetti inclusi nello `starter_pack`)
 * esistano realmente nella tabella `Items`.
 */
export async function checkGrants(grants: string[] | null | undefined): Promise<string | null> {
  if (!grants?.length) {
    return null;
  }

  const found = await db
    .select({ id: items.id })
    .from(items)
    .where(inArray(items.id, grants));

  const foundIds = new Set(found.map((row) => row.id));
  const missing = grants.filter((grantId) => !foundIds.has(grantId));

  return missing.length > 0
    ? `Oggetti regalati inesistenti: ${missing.join(", ")}`
    : null;
}

/** Lancia `HttpError(400)` se l'oggetto viola le regole di business o contiene `grants` inesistenti. */
export async function assertValidItem(item: ItemRules, grantsToVerify?: string[] | null): Promise<void> {
  const problem = itemProblems(item) ?? (await checkGrants(grantsToVerify));
  if (problem) {
    throw new HttpError(400, problem);
  }
}
