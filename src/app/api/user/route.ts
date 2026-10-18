import { NextResponse } from "next/server";
import { db } from "@/db";
import { telegramUsers, userItems, unlockProgress, referrals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateTelegramInitData } from "@/telegram/validate";
import type { TelegramUserProfileResponse } from "@/schemas/telegramUsers";

/**
 * GET /api/user - Recupera il profilo completo del giocatore, gli oggetti sbloccati (userItems),
 * i progressi di sblocco (unlockProgress) e i suoi referral.
 *
 * Solo con header `Authorization: tma <initData>` (Telegram Mini App): il profilo è quello di chi chiama.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const initData = authHeader.startsWith("tma ") ? authHeader.slice(4).trim() : "";
    const { isValid, user: tgUser } = validateTelegramInitData(initData);
    if (!isValid || !tgUser) {
      return NextResponse.json(
        { message: "Telegram initData non valido" },
        { status: 401 }
      );
    }

    const [user] = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, tgUser.id))
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
