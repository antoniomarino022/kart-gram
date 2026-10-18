import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, runs, starPayments, telegramUsers } from "@/db/schema";
import { withTx } from "@/server/tx";
import type { InvoiceRequest, PaymentCheck } from "@/types/game";
import { owns } from "./catalog";
import { grantItem } from "./grant";

/** Registra il pagamento in attesa e crea il link della fattura in Stelle (XTR). */
export async function createInvoice(userId: number, req: InvoiceRequest): Promise<string> {
  const payload = randomBytes(16).toString("hex");

  await db.insert(starPayments).values({
    userId,
    payload,
    purpose: req.purpose,
    itemId: req.itemId ?? null,
    runId: req.runId ?? null,
    stars: req.stars,
  });

  // Import ritardato: il bot richiede BOT_API_KEY, che serve solo qui
  const { bot } = await import("@/telegram/bot");
  const title = req.title.slice(0, 32);

  return bot.telegram.createInvoiceLink({
    title,
    description: req.description.slice(0, 255),
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: title, amount: req.stars }],
  });
}

/** Pagamento ancora da completare e coerente con la fattura (utente, importo, valuta). */
async function pendingPayment(check: PaymentCheck) {
  if (check.currency !== "XTR") {
    return null;
  }

  const [row] = await db
    .select({
      payment: starPayments,
      telegramId: telegramUsers.telegramId,
    })
    .from(starPayments)
    .innerJoin(telegramUsers, eq(telegramUsers.id, starPayments.userId))
    .where(eq(starPayments.payload, check.payload))
    .limit(1);

  const isValid =
    row &&
    row.payment.status === "pending" &&
    row.telegramId === check.telegramId &&
    row.payment.stars === check.amount;

  return isValid ? row.payment : null;
}

/** pre_checkout_query: Telegram chiede conferma prima di addebitare. Rifiuta se l'acquisto non è più valido. */
export async function checkPreCheckout(check: PaymentCheck): Promise<string | null> {
  const payment = await pendingPayment(check);
  if (!payment) {
    return "Pagamento non valido o già completato";
  }

  if (payment.purpose === "revive") {
    const [run] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, payment.runId ?? ""))
      .limit(1);

    if (!run || run.status !== "running" || run.revived) {
      return "Revive non più disponibile";
    }
    return null;
  }

  const [item] = await db
    .select()
    .from(items)
    .where(eq(items.id, payment.itemId ?? ""))
    .limit(1);

  if (!item || !item.isActive) {
    return "Oggetto non più disponibile";
  }

  if (item.kind !== "coin_pack" && (await owns(db, payment.userId, item))) {
    return "Oggetto già posseduto";
  }

  return null;
}

/**
 * successful_payment: le Stelle sono state addebitate.
 * - "delivered": consegnato (o già consegnato prima: un secondo avviso non consegna due volte);
 * - "refund": pagamento sconosciuto o non consegnabile (es. oggetto già posseduto con due fatture aperte): va rimborsato.
 * Un revive pagato quando la partita è già chiusa diventa un revive da usare più avanti.
 */
export async function completeStarPayment(
  check: PaymentCheck & { chargeId: string },
): Promise<"delivered" | "refund"> {
  return withTx(async (tx) => {
    const [row] = await tx
      .select({
        payment: starPayments,
        telegramId: telegramUsers.telegramId,
      })
      .from(starPayments)
      .innerJoin(telegramUsers, eq(telegramUsers.id, starPayments.userId))
      .where(eq(starPayments.payload, check.payload))
      .for("update", { of: starPayments });

    if (row?.payment.status === "paid" && row.payment.telegramChargeId === check.chargeId) {
      return "delivered";
    }

    const isInvalid =
      !row ||
      row.payment.status !== "pending" ||
      row.payment.stars !== check.amount ||
      check.currency !== "XTR" ||
      row.telegramId !== check.telegramId;

    if (isInvalid) {
      return "refund";
    }

    const { payment } = row;

    if (payment.purpose === "revive") {
      const revived = await tx
        .update(runs)
        .set({ revived: true })
        .where(
          and(
            eq(runs.id, payment.runId ?? ""),
            eq(runs.status, "running"),
            eq(runs.revived, false),
          ),
        )
        .returning({ id: runs.id });

      if (revived.length === 0) {
        await tx
          .update(telegramUsers)
          .set({ revives: sql`${telegramUsers.revives} + 1` })
          .where(eq(telegramUsers.id, payment.userId));
      }
    } else {
      const [item] = await tx
        .select()
        .from(items)
        .where(eq(items.id, payment.itemId ?? ""))
        .limit(1);

      if (!item) {
        return "refund";
      }

      if (item.kind !== "coin_pack" && (await owns(tx, payment.userId, item))) {
        return "refund";
      }

      await grantItem(tx, payment.userId, item, "stars");
    }

    await tx
      .update(starPayments)
      .set({
        status: "paid",
        telegramChargeId: check.chargeId,
        paidAt: new Date(),
      })
      .where(eq(starPayments.id, payment.id));

    return "delivered";
  });
}

/** Segna come rimborsato il pagamento (se esiste) dopo refundStarPayment. */
export async function markRefunded(payload: string, chargeId: string): Promise<void> {
  await db
    .update(starPayments)
    .set({ status: "refunded", telegramChargeId: chargeId })
    .where(and(eq(starPayments.payload, payload), eq(starPayments.status, "pending")));
}
