import { redis } from '@/lib/redis';
import { and, eq, or, sql } from "drizzle-orm";
import { Markup, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { db, withTx } from "@/db";
import { items, referrals, runs, starPayments, telegramUsers } from "@/db/schema";
import { grantItem, owns } from "@/lib/game-helpers";
import { ReferralStatus } from "@/types/enums";
import type { PaymentCheck } from "@/types/game";

const token = process.env.BOT_API_KEY || "placeholder_token";

export const bot = new Telegraf(token);

// ---------------------------------------------------------------------------
// Verifica e Consegna Pagamenti Telegram Stars
// ---------------------------------------------------------------------------

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

async function checkPreCheckout(check: PaymentCheck): Promise<string | null> {
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

async function completeStarPayment(
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

async function markRefunded(payload: string, chargeId: string): Promise<void> {
  await db
    .update(starPayments)
    .set({ status: "refunded", telegramChargeId: chargeId })
    .where(and(eq(starPayments.payload, payload), eq(starPayments.status, "pending")));
}

function refundStars(userId: number, chargeId: string) {
  const callApi = bot.telegram.callApi.bind(bot.telegram) as unknown as (
    method: string,
    payload: object,
  ) => Promise<true>;
  return callApi("refundStarPayment", {
    user_id: userId,
    telegram_payment_charge_id: chargeId,
  });
}

// ---------------------------------------------------------------------------
// Comandi e Eventi del Bot
// ---------------------------------------------------------------------------

bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const username = ctx.from.username ?? null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const startPayload = ctx.startPayload?.trim() ?? "";

    const [existingUser] = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, telegramId))
      .limit(1);

    if (!existingUser) {
      let profileIcon: string | undefined;

      try {
        const photos = await ctx.telegram.getUserProfilePhotos(telegramId, 0, 1);
        if (photos.total_count > 0) {
          const fileId = photos.photos[0][0].file_id;
          const fileLink = await ctx.telegram.getFileLink(fileId);
          profileIcon = fileLink.href;
        }
      } catch (photoErr) {
        console.warn("Impossibile recuperare la foto profilo:", photoErr);
      }

      const [newUser] = await db
        .insert(telegramUsers)
        .values({
          telegramId,
          username,
          profileIcon,
        })
        .returning();

      if (newUser && startPayload) {
        const rawRef = startPayload.startsWith("ref_")
          ? startPayload.slice(4)
          : startPayload;
        const inviterRefNumber = Number(rawRef);

        if (Number.isInteger(inviterRefNumber) && inviterRefNumber > 0) {
          const [inviter] = await db
            .select({ id: telegramUsers.id })
            .from(telegramUsers)
            .where(
              or(
                eq(telegramUsers.id, inviterRefNumber),
                eq(telegramUsers.telegramId, inviterRefNumber),
              ),
            )
            .limit(1);

          if (inviter && inviter.id !== newUser.id) {
            await db
              .insert(referrals)
              .values({
                inviterUserId: inviter.id,
                invitedUserId: newUser.id,
                status: ReferralStatus.PENDING,
              })
              .onConflictDoNothing();
            const now = new Date();
            const ym = now.getUTCFullYear() + '-' + String(now.getUTCMonth() + 1).padStart(2, '0');
            redis.zincrby('leaderboard:monthly:referrals:' + ym, 1, String(inviter.id)).catch(() => {});
          }
        }
      }
    }

    await ctx.reply(
      `Ciao ${ctx.from.first_name}! 🏎️\nPronto a scendere in pista su Kart-Gram?`,
      Markup.inlineKeyboard([Markup.button.webApp("Gioca Ora 🏁", appUrl)]),
    );
  } catch (error) {
    console.error("Errore durante /start:", error);
    await ctx.reply("Si è verificato un errore durante l'avvio del gioco. Riprova tra poco.");
  }
});

bot.on("pre_checkout_query", async (ctx) => {
  const query = ctx.preCheckoutQuery;
  try {
    const error = await checkPreCheckout({
      payload: query.invoice_payload,
      telegramId: query.from.id,
      amount: query.total_amount,
      currency: query.currency,
    });
    await ctx.answerPreCheckoutQuery(error === null, error ?? undefined);
  } catch (error) {
    console.error("Errore pre_checkout_query:", error);
    await ctx.answerPreCheckoutQuery(false, "Errore temporaneo, riprova tra poco");
  }
});

bot.on(message("successful_payment"), async (ctx) => {
  const payment = ctx.message.successful_payment;
  const chargeId = payment.telegram_payment_charge_id;
  let result: "delivered" | "refund";

  try {
    result = await completeStarPayment({
      payload: payment.invoice_payload,
      telegramId: ctx.from.id,
      amount: payment.total_amount,
      currency: payment.currency,
      chargeId,
    });
  } catch (error) {
    console.error("Errore consegna pagamento:", chargeId, error);
    result = "refund";
  }

  if (result === "delivered") {
    return;
  }

  try {
    await refundStars(ctx.from.id, chargeId);
  } catch (error) {
    console.error("Rimborso non riuscito, da gestire a mano:", chargeId, error);
    return;
  }

  await ctx
    .reply("Non è stato possibile completare l'acquisto: le Stelle ti sono state restituite.")
    .catch(() => {});

  await markRefunded(payment.invoice_payload, chargeId).catch((error) =>
    console.error("Rimborso fatto ma non registrato:", chargeId, error),
  );
});
