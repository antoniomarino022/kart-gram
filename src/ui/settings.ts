import { setHapticsGate } from "@/telegram/hapticsGate";
import { haptic } from "@/telegram/webapp";

/** Impostazioni locali del giocatore (solo browser, localStorage). */
const HAPTICS_KEY = "kartgram.haptics";

let hapticsOn: boolean | null = null;

export function hapticsEnabled(): boolean {
  if (hapticsOn === null) {
    try { hapticsOn = localStorage.getItem(HAPTICS_KEY) !== "off"; } catch { hapticsOn = true; }
    setHapticsGate(hapticsOn);
  }
  return hapticsOn;
}

export function setHapticsEnabled(on: boolean) {
  hapticsOn = on;
  setHapticsGate(on);
  try { localStorage.setItem(HAPTICS_KEY, on ? "on" : "off"); } catch { /* storage non disponibile: vale solo per questa sessione */ }
}

/** haptic() che rispetta l'interruttore vibrazione (il gate vale anche per le vibrazioni del Game). */
export function uiHaptic(kind: Parameters<typeof haptic>[0]) {
  if (hapticsEnabled()) haptic(kind);
}
