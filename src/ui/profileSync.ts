import type { Profile } from "@/types/game";

/** Applica il profilo restituito da una richiesta e restituisce il valore originale. */
export type TrackProfile = <T extends Profile | null>(request: Promise<T>) => Promise<T>;

/**
 * Ogni richiesta che restituisce un profilo riceve un numero crescente al momento della partenza:
 * una risposta più vecchia di quella già applicata viene ignorata (non sovrascrive dati più nuovi).
 */
export function createProfileTracker(apply: (p: Profile) => void): TrackProfile {
  let next = 0;
  let applied = 0;
  return async (request) => {
    const id = ++next;
    const p = await request;
    if (p && id > applied) {
      applied = id;
      apply(p);
    }
    return p;
  };
}
