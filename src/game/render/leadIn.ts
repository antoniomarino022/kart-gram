import { STEP } from "../core/config";
import type { Track, TrackSample } from "../core/track";

/**
 * Metri di strada solo visiva prima di s = 0, lungo la tangente iniziale: nel menu e a inizio partita
 * la camera vede strada dietro al kart invece del vuoto. Non esiste per la simulazione.
 */
export const LEAD_IN = 60;

/** Campione virtuale `d` metri prima del primo campione (d in [0, LEAD_IN]). */
export function leadInSample(track: Track, d: number): TrackSample {
  const a = track.samples[0];
  return { ...a, s: a.s - d, x: a.x - Math.cos(a.angle) * d, y: a.y - Math.sin(a.angle) * d, curvature: 0 };
}

/** Tutti i campioni virtuali, dal più lontano (−LEAD_IN) a s = 0 compreso. */
export function leadInSamples(track: Track): TrackSample[] {
  const out: TrackSample[] = [];
  for (let d = LEAD_IN; d >= 0; d -= STEP) out.push(leadInSample(track, d));
  return out;
}
