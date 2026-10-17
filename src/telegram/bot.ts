import { Telegraf, Markup } from "telegraf";
import { db } from "@/db";
import { telegramUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

const token = process.env.BOT_API_KEY;

if (!token) {
  throw new Error("BOT_API_KEY is not defined in environment variables.");
}

export const bot = new Telegraf(token);

// Gestione comando /start
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const username = ctx.from.username ?? null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

    // Registra o recupera l'utente nel database
    const [existingUser] = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, telegramId))
      .limit(1);

    if (!existingUser) {
      let profileIcon: string | undefined = undefined;

      // Recupera la foto profilo da Telegram
      const photos = await ctx.telegram.getUserProfilePhotos(telegramId, 0, 1);
      if (photos.total_count > 0) {
        const fileId = photos.photos[0][0].file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);
        profileIcon = fileLink.href;
      }

      await db.insert(telegramUsers).values({
        telegramId,
        username,
        profileIcon,
      });
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
