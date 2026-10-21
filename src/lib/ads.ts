/**
 * Integrazione Adsgram per Telegram Mini App.
 * Documentazione: https://adsgram.ai
 */

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<{ done: boolean; description: string; state: string }>;
      };
    };
  }
}

export interface ShowAdResult {
  success: boolean;
  error?: string;
}

/**
 * Mostra un annuncio pubblicitario Rewarded Video di Adsgram.
 * La ricompensa viene sbloccata SOLO ed ESCLUSIVAMENTE se l'utente
 * guarda l'intero video sponsorizzato fino alla fine.
 *
 * Il Block ID viene letto esclusivamente dalla variabile d'ambiente NEXT_PUBLIC_ADSGRAM_BLOCK_ID
 * senza valori hardcoded nel codice sorgente.
 */
export async function showRewardedAd(): Promise<ShowAdResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Ambiente non supportato" };
  }

  const blockId = String(process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID || "").trim();

  if (!blockId) {
    return {
      success: false,
      error: "Block ID non configurato nelle variabili d'ambiente",
    };
  }

  // Verifica presenza SDK Adsgram
  if (!window.Adsgram) {
    return {
      success: false,
      error: "SDK pubblicitario non caricato. Riprova da Telegram.",
    };
  }

  try {
    const isDebug = process.env.NODE_ENV !== "production";
    const adController = window.Adsgram.init({
      blockId,
      debug: isDebug,
    });

    const result = await adController.show();

    if (result && result.done) {
      return { success: true };
    }

    return {
      success: false,
      error: result?.description || "Video non completato",
    };
  } catch (err: unknown) {
    const errorObj = err as { description?: string; message?: string };
    const desc = errorObj?.description || errorObj?.message || "Annuncio non completato";
    return { success: false, error: desc };
  }
}
