import crypto from "crypto";

/** Validità di initData dopo la firma di Telegram (la mini app lo rigenera a ogni apertura). */
const MAX_AGE_SECONDS = 6 * 60 * 60;

export interface ValidatedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

/**
 * Valida la stringa `initData` fornita da window.Telegram.WebApp.initData
 * usando HMAC-SHA256 e il token segreto del bot.
 * Impedisce a chiunque di falsificare il proprio userId o impersonare altri giocatori.
 */
export function validateTelegramInitData(initData: string): {
  isValid: boolean;
  user: ValidatedTelegramUser | null;
} {
  const token = process.env.BOT_API_KEY;
  if (!token || !initData) {
    return { isValid: false, user: null };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");

    if (!hash) {
      return { isValid: false, user: null };
    }

    urlParams.delete("hash");

    // Ordina alfabeticamente i parametri per calcolare la firma
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Calcola la chiave segreta (HMAC-SHA256("WebAppData", BOT_TOKEN))
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    // Calcola l'hash della stringa dati
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const expected = Buffer.from(calculatedHash, "hex");
    const received = Buffer.from(hash, "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return { isValid: false, user: null };
    }

    // initData firmato ma vecchio: un valore intercettato non deve valere per sempre
    const authDate = Number(urlParams.get("auth_date"));
    if (!Number.isFinite(authDate) || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
      return { isValid: false, user: null };
    }

    const userParam = urlParams.get("user");
    const user: ValidatedTelegramUser | null = userParam ? JSON.parse(userParam) : null;

    return { isValid: true, user };
  } catch (error) {
    console.error("Errore validazione Telegram initData:", error);
    return { isValid: false, user: null };
  }
}
