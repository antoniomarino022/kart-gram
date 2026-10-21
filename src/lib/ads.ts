/**
 * Integrazione Adsgram per Telegram Mini App.
 * Documentazione: https://adsgram.ai
 */

import { requestApi } from "./api";

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

let cachedBlockId: string | null = null;

async function getBlockId(): Promise<string> {
  if (cachedBlockId) return cachedBlockId;

  // Prova prima la variabile pubblica se presente
  const envId = (process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID || "").trim();
  if (envId) {
    cachedBlockId = envId;
    return envId;
  }

  // Altrimenti recupera l'ID dal server (dove su Vercel c'è ADSGRAM_BLOCK_ID)
  try {
    const res = await requestApi<{ blockId: string }>("GET", "/ads/config");
    if (res?.blockId) {
      cachedBlockId = res.blockId;
      return res.blockId;
    }
  } catch (err) {
    console.warn("[ads] Impossibile recuperare blockId dal server:", err);
  }

  return "";
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

  const blockId = await getBlockId();

  if (!blockId) {
    return {
      success: false,
      error: "Block ID non configurato (imposta ADSGRAM_BLOCK_ID su Vercel o in .env)",
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
