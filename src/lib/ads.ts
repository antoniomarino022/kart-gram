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

// Inserisci qui il tuo Block ID da https://adsgram.ai
// Se vuoto o in sviluppo locale, usa una modalità demo simulata
export const ADSGRAM_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID || "int-12345";

export interface ShowAdResult {
  success: boolean;
  error?: string;
}

/**
 * Mostra un annuncio pubblicitario Rewarded Video di Adsgram.
 * In ambiente browser normale o se Adsgram non è configurato, simula l'annuncio dopo 2 secondi
 * per permetterti di testare comodamente senza errori bloccanti.
 */
export async function showRewardedAd(): Promise<ShowAdResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Ambiente non supportato" };
  }

  // Se siamo in Telegram e Adsgram SDK è caricato
  if (window.Adsgram && ADSGRAM_BLOCK_ID && ADSGRAM_BLOCK_ID !== "int-12345") {
    try {
      const adController = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
      const result = await adController.show();
      if (result.done) {
        return { success: true };
      }
      return { success: false, error: result.description || "Video non completato" };
    } catch (err: unknown) {
      const errorObj = err as { description?: string };
      return { success: false, error: errorObj?.description || "Errore riproduzione annuncio" };
    }
  }

  // Modalità simulazione / test (per sviluppo rapido)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true });
    }, 1500);
  });
}
