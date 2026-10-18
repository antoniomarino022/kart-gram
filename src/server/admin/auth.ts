import { auth } from "@/lib/auth";
import { HttpError } from "@/server/http";

const trustedOrigins = [
  process.env.DASHBOARD_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
]
  .filter((url): url is string => Boolean(url))
  .map((url) => url.replace(/\/+$/, ""));

/**
 * Sessione della dashboard con ruolo admin, altrimenti 401/403.
 * Il cookie di sessione è SameSite=None: le richieste che modificano devono arrivare da un'origine fidata (niente CSRF).
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
