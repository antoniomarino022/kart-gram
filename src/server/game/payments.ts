import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, playerItems, runs, starPayments, telegramUsers } from "@/db/schema";
import { withTx } from "@/server/tx";
import { isFree } from "./catalog";
import { grantItem } from "./grant";

interface PaymentCheck { payload: string; telegramId: number; amount: number; currency: string }

/** Pagamento ancora da completare e coerente con la fattura (utente, importo, valuta). */
async function pendingPayment(c: PaymentCheck) {
  if (c.currency !== "XTR") return null;
  const [row] = await db
    .select({ p: starPayments, telegramId: telegramUsers.telegramId })
    .from(starPayments)
    .innerJoin(telegramUsers, eq(telegramUsers.id, starPayments.userId))
    .where(eq(starPayments.payload, c.payload))
    .limit(1);
  if (!row || row.p.status !== "pending" || row.telegramId !== c.telegramId || row.p.stars !== c.amount) return null;
  return row.p;
}

/** pre_checkout_query: Telegram chiede conferma prima di addebitare. Rifiuta se l'acquisto non è più valido. */
export async function checkPreCheckout(c: PaymentCheck): Promise<string | null> {
  const p = await pendingPayment(c);
  if (!p) return "Pagamento non valido o già completato";
  if (p.purpose === "revive") {
    const [run] = await db.select().from(runs).where(eq(runs.id, p.runId ?? "")).limit(1);
    if (!run || run.status !== "running" || run.revived) return "Revive non più disponibile";
    return null;
  }
  const [item] = await db.select().from(items).where(eq(items.id, p.itemId ?? "")).limit(1);
  if (!item || !item.isActive) return "Oggetto non più disponibile";
  if (item.kind !== "coin_pack") {
    const [owned] = await db.select().from(playerItems).where(and(eq(playerItems.userId, p.userId), eq(playerItems.itemId, item.id))).limit(1);
    if (owned || isFree(item)) return "Oggetto già posseduto";
  }
  return null;
}

/**
 * successful_payment: le Stelle sono state addebitate.
 * - "delivered": consegnato (o già consegnato prima: un secondo avviso non consegna due volte);
 * - "refund": pagamento sconosciuto o non consegnabile (es. oggetto già posseduto con due fatture aperte): va rimborsato.
 * Un revive pagato quando la partita è già chiusa diventa un revive da usare più avanti.
 */
export async function completeStarPayment(c: PaymentCheck & { chargeId: string }): Promise<"delivered" | "refund"> {
  return withTx(async (tx) => {
    const [row] = await tx
      .select({ p: starPayments, telegramId: telegramUsers.telegramId })
      .from(starPayments)
      .innerJoin(telegramUsers, eq(telegramUsers.id, starPayments.userId))
      .where(eq(starPayments.payload, c.payload))
      .for("update", { of: starPayments });
    if (row?.p.status === "paid" && row.p.telegramChargeId === c.chargeId) return "delivered";
    if (!row || row.p.status !== "pending" || row.p.stars !== c.amount || c.currency !== "XTR" || row.telegramId !== c.telegramId) return "refund";
    const p = row.p;

    if (p.purpose === "revive") {
      const revived = await tx
        .update(runs)
        .set({ revived: true })
        .where(and(eq(runs.id, p.runId ?? ""), eq(runs.status, "running"), eq(runs.revived, false)))
        .returning({ id: runs.id });
      if (!revived.length) await tx.update(telegramUsers).set({ revives: sql`${telegramUsers.revives} + 1` }).where(eq(telegramUsers.id, p.userId));
    } else {
      const [item] = await tx.select().from(items).where(eq(items.id, p.itemId ?? "")).limit(1);
      if (!item) return "refund";
      if (item.kind !== "coin_pack") {
        const [owned] = await tx.select().from(playerItems).where(and(eq(playerItems.userId, p.userId), eq(playerItems.itemId, item.id))).limit(1);
        if (owned) return "refund";
      }
      await grantItem(tx, p.userId, item, "stars");
    }
    await tx
      .update(starPayments)
      .set({ status: "paid", telegramChargeId: c.chargeId, paidAt: new Date() })
      .where(eq(starPayments.id, p.id));
    return "delivered";
  });
}

/** Segna come rimborsato il pagamento (se esiste) dopo refundStarPayment. */
export async function markRefunded(payload: string, chargeId: string) {
  await db
    .update(starPayments)
    .set({ status: "refunded", telegramChargeId: chargeId })
    .where(and(eq(starPayments.payload, payload), eq(starPayments.status, "pending")));
}
