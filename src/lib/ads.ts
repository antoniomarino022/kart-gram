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


export const ADSGRAM_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID!;

export interface ShowAdResult {
  success: boolean;
  error?: string;
}

/**
 * Mostra un annuncio pubblicitario Rewarded Video di Adsgram.
 * La ricompensa viene sbloccata SOLO ed ESCLUSIVAMENTE se l'utente
 * guarda l'intero video sponsorizzato fino alla fine.
 */
export async function showRewardedAd(): Promise<ShowAdResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Ambiente non supportato" };
  }

  // Verifica presenza SDK Adsgram
  if (!window.Adsgram) {
    return {
      success: false,
      error: "SDK pubblicitario non disponibile o bloccato da AdBlock",
    };
  }

  try {
    const isDebug = process.env.NODE_ENV !== "production" || ADSGRAM_BLOCK_ID === "int-test";
    const adController = window.Adsgram.init({
      blockId: ADSGRAM_BLOCK_ID,
      debug: isDebug,
    });

    const result = await adController.show();

    if (result && result.done) {
      return { success: true };
    }

    return {
      success: false,
      error: result?.description || "Video interrotto prima del termine",
    };
  } catch (err: unknown) {
    const errorObj = err as { description?: string; message?: string };
    const desc = errorObj?.description || errorObj?.message || "Annuncio non completato";
    return { success: false, error: desc };
  }
}
