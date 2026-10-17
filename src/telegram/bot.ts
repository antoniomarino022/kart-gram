import { Telegraf, Markup } from "telegraf";
import { db } from "@/db";
import { telegramUsers, referrals } from "@/db/schema";
import { ReferralStatus } from "@/types/enums";
import { eq, or } from "drizzle-orm";

const token = process.env.BOT_API_KEY;

if (!token) {
  throw new Error("BOT_API_KEY is not defined in environment variables.");
}

export const bot = new Telegraf(token);

// Gestione comando /start (supporta anche deep link referral es. ?start=ref_123)
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const username = ctx.from.username ?? null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const startPayload = ctx.startPayload?.trim() ?? "";

    // Registra o recupera l'utente nel database
    const [existingUser] = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, telegramId))
      .limit(1);

    if (!existingUser) {
      let profileIcon: string | undefined = undefined;

      // Recupera la foto profilo da Telegram
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

      // Gestione referral se il nuovo utente è entrato tramite link (es. ?start=ref_123 o ?start=123)
      if (newUser && startPayload) {
        const rawRef = startPayload.startsWith("ref_")
          ? startPayload.slice(4)
          : startPayload;
        const inviterRefNumber = Number(rawRef);

        if (Number.isInteger(inviterRefNumber) && inviterRefNumber > 0) {
          // Cerca l'invitante per id interno o per telegramId
          const [inviter] = await db
            .select({ id: telegramUsers.id })
            .from(telegramUsers)
            .where(
              or(
                eq(telegramUsers.id, inviterRefNumber),
                eq(telegramUsers.telegramId, inviterRefNumber)
              )
            )
            .limit(1);

          // Evita auto-inviti e registra il referral in stato PENDING
          if (inviter && inviter.id !== newUser.id) {
            await db
              .insert(referrals)
              .values({
                inviterUserId: inviter.id,
                invitedUserId: newUser.id,
                status: ReferralStatus.PENDING,
              })
              .onConflictDoNothing();
          }
        }
      }
    }

    await ctx.reply(
      `Ciao ${ctx.from.first_name}! 🏎️\nPronto a scendere in pista su Kart-Gram?`,
      Markup.inlineKeyboard([
        Markup.button.webApp("Gioca Ora 🏁", appUrl),
      ])
    );
  } catch (error) {
    console.error("Errore durante /start:", error);
    await ctx.reply("Si è verificato un errore durante l'avvio del gioco. Riprova tra poco.");
  }
});
