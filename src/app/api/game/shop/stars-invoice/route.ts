import { db } from "@/db";
import { requirePlayer } from "@/lib/auth";
import { activeItem, createInvoice, ownedIds } from "@/lib/game-helpers";
import { bad, handle } from "@/lib/http";
import { buyItemBodySchema } from "@/schemas/game";
import type { ItemRow } from "@/types/game";

/** Costruisce la descrizione mostrata nel popup di pagamento Telegram Stars. */
function buildInvoiceDescription(item: ItemRow): string {
  if (item.kind === "coin_pack") {
    return `${item.coins ?? 0} monete`;
  }
  if (item.kind === "starter_pack") {
    return "Pacchetto di benvenuto";
  }
  return `Sblocca ${item.name}`;
}

/**
 * POST /api/game/shop/stars-invoice
 *
 * Genera un link di pagamento Telegram Stars (`XTR`) per acquistare un oggetto dello Shop
 * (es. cosmetico esclusivo, `coin_pack` o `starter_pack`).
 * Body: `{ itemId: string }`
 *
 * - Verifica che l'oggetto sia attivo e abbia un prezzo in Stelle (`priceStars !== null`);
 * - Se non è un pacchetto di monete ripetibile, verifica che non sia già posseduto;
 * - Registra il pagamento in stato `pending` in `Star_Payments` e chiede a Telegram il link fattura;
 * - La consegna effettiva avverrà tramite il webhook `/api/telegram` all'evento `successful_payment`.
 */
export const POST = handle(async (request: Request) => {
  const player = await requirePlayer(request);
  const { itemId } = buyItemBodySchema.parse(await request.json());

  const item = await activeItem(db, itemId);
  if (item.priceStars === null) {
    throw bad("Oggetto non acquistabile con le Stelle");
  }

  // Gli oggetti singoli e lo starter pack si possono comprare una sola volta
  if (item.kind !== "coin_pack") {
    const owned = await ownedIds(player.id);
    if (owned.has(item.id)) {
      throw bad("Oggetto già posseduto");
    }
  }

  const invoiceLink = await createInvoice(player.id, {
    purpose: "item",
    itemId: item.id,
    stars: item.priceStars,
    title: item.name,
    description: buildInvoiceDescription(item),
  });

  return { invoiceLink };
});
