import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { telegramUsers } from "@/db/schema";
import { HttpError } from "@/lib/http";
import { validateTelegramInitData } from "@/telegram/validate";
import type { PlayerRow } from "@/types/game";

const trustedOrigins = [
  process.env.DASHBOARD_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
]
  .filter((url): url is string => Boolean(url))
  .map((url) => url.replace(/\/+$/, ""));

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.DASHBOARD_URL,
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Admin creati a mano: la registrazione pubblica darebbe accesso alla dashboard a chiunque
    disableSignUp: true,
  },
  trustedOrigins,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
});

export type Session = typeof auth.$Infer.Session;

/**
 * Sessione della dashboard con ruolo admin, altrimenti 401/403.
 * Il cookie di sessione è SameSite=None: le richieste che modificano devono arrivare da un'origine fidata.
 */
export async function requireAdmin(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  if (request.method !== "GET" && !trustedOrigins.includes(origin)) {
    throw new HttpError(403, "Origine non consentita");
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    throw new HttpError(401, "Accesso richiesto");
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    throw new HttpError(403, "Accesso negato: solo per amministratori");
  }

  return session;
}

/**
 * Giocatore della richiesta, dall'header `Authorization: tma <initData>` firmato da Telegram.
 * Al primo accesso dalla mini app crea la riga (chi non è passato da /start nel bot).
 */
export async function requirePlayer(request: Request): Promise<PlayerRow> {
  const header = request.headers.get("authorization") ?? "";
  const initData = header.startsWith("tma ") ? header.slice(4).trim() : "";
  const { isValid, user } = validateTelegramInitData(initData);

  if (!isValid || !user) {
    throw new HttpError(401, "Accesso Telegram non valido");
  }

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").slice(0, 100) || null;
  const username = user.username ?? null;

  let [row] = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramId, user.id))
    .limit(1);

  if (!row) {
    await db
      .insert(telegramUsers)
      .values({ telegramId: user.id, username, displayName })
      .onConflictDoNothing();

    [row] = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, user.id))
      .limit(1);
  } else if (row.username !== username || (!row.displayName && displayName)) {
    [row] = await db
      .update(telegramUsers)
      .set({
        username,
        displayName: row.displayName ?? displayName,
      })
      .where(eq(telegramUsers.id, row.id))
      .returning();
  }

  if (row.isBanned) {
    throw new HttpError(403, "Account sospeso");
  }

  return row;
}
