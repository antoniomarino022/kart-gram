import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramUsers } from "@/db/schema";
import { validateTelegramInitData } from "@/telegram/validate";
import { HttpError } from "@/server/http";

export type PlayerRow = typeof telegramUsers.$inferSelect;

/**
 * Giocatore della richiesta, dall'header `Authorization: tma <initData>` firmato da Telegram.
 * Al primo accesso dalla mini app crea la riga (chi non è passato da /start nel bot).
 */
export async function requirePlayer(request: Request): Promise<PlayerRow> {
  const header = request.headers.get("authorization") ?? "";
  const initData = header.startsWith("tma ") ? header.slice(4).trim() : "";
  const { isValid, user } = validateTelegramInitData(initData);
  if (!isValid || !user) throw new HttpError(401, "Accesso Telegram non valido");

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").slice(0, 100) || null;
  const username = user.username ?? null;
  // prima si legge: un upsert a ogni richiesta consumerebbe un id della sequenza anche quando il giocatore esiste già
  let [row] = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, user.id)).limit(1);
  if (!row) {
    await db.insert(telegramUsers).values({ telegramId: user.id, username, displayName }).onConflictDoNothing();
    [row] = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, user.id)).limit(1);
  } else if (row.username !== username || (!row.displayName && displayName)) {
    // il nome mostrato si prende da Telegram solo se manca: un nome cambiato dalla dashboard resta
    [row] = await db.update(telegramUsers).set({ username, displayName: row.displayName ?? displayName }).where(eq(telegramUsers.id, row.id)).returning();
  }
  if (row.isBanned) throw new HttpError(403, "Account sospeso");
  return row;
}

export async function getPlayer(userId: number): Promise<PlayerRow> {
  const [row] = await db.select().from(telegramUsers).where(eq(telegramUsers.id, userId)).limit(1);
  if (!row) throw new HttpError(404, "Giocatore non trovato");
  return row;
}

export const playerName = (p: Pick<PlayerRow, "displayName" | "username">) => p.displayName || p.username || "Pilota";
