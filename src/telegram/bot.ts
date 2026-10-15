import { Telegraf, Markup } from "telegraf";
import { db } from "@/db";
import { users } from "@/db/schema";
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
    const existingUser = await db.query.users.findFirst({
      where: eq(users.telegramId, telegramId),
    });

    if (!existingUser) {
      await db.insert(users).values({
        telegramId,
        username,
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
