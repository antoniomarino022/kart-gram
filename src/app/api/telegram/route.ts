import { bot } from "@/telegram/bot";

/**
 * POST /api/telegram
 *
 * Endpoint webhook chiamato dai server di Telegram ad ogni evento del Bot:
 * - comando `/start` (registrazione utente e tracciamento link referral);
 * - `pre_checkout_query` (conferma preventiva validità acquisto con Telegram Stars);
 * - `successful_payment` (accredito monete/oggetti/revive o rimborso automatico in caso di conflitto).
 *
 * Verifica l'header `x-telegram-bot-api-secret-token` se `TELEGRAM_WEBHOOK_SECRET` è configurato.
 */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerToken = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret && headerToken !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const update = await request.json();
    await bot.handleUpdate(update);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Errore webhook Telegram:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * GET /api/telegram
 *
 * Health-check rapido per verificare che l'endpoint webhook sia raggiungibile.
 */
export async function GET() {
  return new Response("Telegram Webhook active", { status: 200 });
}
