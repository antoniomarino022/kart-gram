import { createMockBackend } from "./mock";
import { createRemoteBackend } from "./remote";
import type { Backend } from "./types";
import { getInitData, isTelegram } from "@/telegram/webapp";

let instance: Backend | null = null;

/**
 * "remote" = API del gioco sul DB, "mock" = dati finti in localStorage.
 * Senza scelta esplicita (o con "auto"): remote dentro Telegram, mock nel browser del PC (non c'è initData per autenticarsi).
 */
export function isRemoteBackend(): boolean {
  const mode = process.env.NEXT_PUBLIC_BACKEND;
  return mode === "remote" || ((!mode || mode === "auto") && isTelegram());
}

export function getBackend(): Backend {
  if (instance) return instance;
  instance = isRemoteBackend()
    ? createRemoteBackend({ baseUrl: process.env.NEXT_PUBLIC_API_URL || "/api/game", getInitData })
    : createMockBackend({ storage: window.localStorage, startCoins: Number(process.env.NEXT_PUBLIC_MOCK_COINS) || 5000 });
  return instance;
}

export * from "./types";
