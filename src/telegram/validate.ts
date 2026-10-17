import crypto from "crypto";

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
      .sort(([a], [b]) => a.localeCompare(b))
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

    if (calculatedHash !== hash) {
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
