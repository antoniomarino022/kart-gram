import { NextResponse } from "next/server";
import { db } from "@/db";
import { telegramUsers, userItems, unlockProgress, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateTelegramInitData } from "@/telegram/validate";
import type { TelegramUserProfileResponse } from "@/schemas/telegramUsers";

export const dynamic = "force-dynamic";

/**
 * GET /api/user - Recupera il profilo completo del giocatore, gli oggetti sbloccati (userItems),
 * i progressi di sblocco (unlockProgress) e i suoi referral.
 *
 * Supporta:
 * 1) Header `Authorization: tma <initData>` (Telegram Mini App)
 * 2) Query param `?userId=<id>` oppure `?telegramId=<telegramId>`
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");
    const telegramIdParam = searchParams.get("telegramId");

    let targetUserId: number | null = userIdParam ? Number(userIdParam) : null;
    let targetTelegramId: number | null = telegramIdParam ? Number(telegramIdParam) : null;

    // Se non sono passati query param, prova a validare l'header Authorization: tma <initData>
    if (!targetUserId && !targetTelegramId) {
      const authHeader = request.headers.get("authorization") ?? "";
      const initData = authHeader.startsWith("tma ")
        ? authHeader.slice(4).trim()
        : authHeader.trim();

      if (initData) {
        const { isValid, user: tgUser } = validateTelegramInitData(initData);
        if (!isValid || !tgUser) {
          return NextResponse.json(
            { message: "Telegram initData non valido" },
            { status: 401 }
          );
        }
        targetTelegramId = tgUser.id;
      }
    }

    if (!targetUserId && !targetTelegramId) {
      return NextResponse.json(
        { message: "Specifica userId, telegramId oppure invia l'header Authorization tma" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select()
      .from(telegramUsers)
      .where(
        targetUserId
          ? eq(telegramUsers.id, targetUserId)
          : eq(telegramUsers.telegramId, targetTelegramId!)
      )
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { message: "Utente non trovato" },
        { status: 404 }
      );
    }

    const [ownedItemsList, progressList, referralsList] = await Promise.all([
      db.select().from(userItems).where(eq(userItems.userId, user.id)),
      db.select().from(unlockProgress).where(eq(unlockProgress.userId, user.id)),
      db.select().from(referrals).where(eq(referrals.inviterUserId, user.id)),
    ]);

    const response: TelegramUserProfileResponse = {
      user,
      ownedItems: ownedItemsList,
      unlockProgress: progressList,
      referrals: referralsList,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Errore durante il recupero del profilo utente:", error);
    return NextResponse.json(
      { message: "Errore interno del server" },
      { status: 500 }
    );
  }
}
