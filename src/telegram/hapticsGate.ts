/** Interruttore globale della vibrazione: lo imposta la UI (impostazioni), lo legge `haptic()`. */
let enabled = true;

export const hapticsGateOpen = () => enabled;
export function setHapticsGate(on: boolean) { enabled = on; }
