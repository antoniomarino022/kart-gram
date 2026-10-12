import { haptic } from "@/telegram/webapp";

/** Impostazioni locali del giocatore (solo browser, localStorage). */
const HAPTICS_KEY = "kartgram.haptics";

let hapticsOn: boolean | null = null;

export function hapticsEnabled(): boolean {
  if (hapticsOn === null) {
    try { hapticsOn = localStorage.getItem(HAPTICS_KEY) !== "off"; } catch { hapticsOn = true; }
  }
  return hapticsOn;
}

export function setHapticsEnabled(on: boolean) {
  hapticsOn = on;
  try { localStorage.setItem(HAPTICS_KEY, on ? "on" : "off"); } catch { /* storage non disponibile: vale solo per questa sessione */ }
}

/**
 * haptic() che rispetta l'interruttore vibrazione.
 * TODO(merge): anche Game.ts chiama haptic() direttamente (eventi e inizio drift): al merge farlo passare
 * da qui (o da hapticsEnabled()), altrimenti la vibrazione in partita ignora l'interruttore.
 */
export function uiHaptic(kind: Parameters<typeof haptic>[0]) {
  if (hapticsEnabled()) haptic(kind);
}
