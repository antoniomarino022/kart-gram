import { bot } from "@/telegram/bot";

export async function POST(req: Request) {
  // con TELEGRAM_WEBHOOK_SECRET impostato (e passato a setWebhook) si accettano solo gli update firmati da Telegram
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const update = await req.json();
    await bot.handleUpdate(update);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Errore webhook Telegram:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Telegram Webhook active", { status: 200 });
}
