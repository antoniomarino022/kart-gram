import { STEP } from "../core/config";
import type { Track } from "../core/track";
import { LEAD_IN, leadInSample } from "./leadIn";

/** Edifici: blocchi dritti allineati agli assi, a 12–90 m dal centro strada (vicino alla strada si vede il suolo). */
export const BUILDING = {
  minDist: 12, maxDist: 90,
  minWidth: 4, maxWidth: 14,
  /** Altezza della cima sopra il livello della strada. */
  minTop: 5, maxTop: 45,
  /** Distanza minima (oltre la mezza larghezza della strada) da qualunque campione vicino. */
  clearance: 6,
  /** Raggio (in metri di strada) entro cui controllare i campioni. */
  scan: 320,
} as const;

/** Rettangolo allineato agli assi in coordinate core (x, y). */
export interface Footprint { x: number; y: number; halfW: number; halfD: number }

export interface Placement extends Footprint { top: number }

/** Distanza tra un punto e un rettangolo allineato agli assi (0 se dentro). */
export function rectDistance(r: Footprint, px: number, py: number) {
  const dx = Math.max(0, Math.abs(px - r.x) - r.halfW);
  const dy = Math.max(0, Math.abs(py - r.y) - r.halfD);
  return Math.hypot(dx, dy);
}

/**
 * true se il rettangolo resta ad almeno `clearance` m dal bordo strada per i campioni in [from, to].
 * Se l'intervallo arriva all'inizio della strada controlla anche il tratto visivo prima di s = 0.
 */
export function clearOfRoad(track: Track, r: Footprint, from: number, to: number, clearance: number = BUILDING.clearance) {
  const S = track.samples;
  if (from <= 0 && to >= 0) {
    for (let d = 1; d <= LEAD_IN; d += STEP) {
      const q = leadInSample(track, d);
      if (rectDistance(r, q.x, q.y) < clearance + q.width / 2) return false;
    }
  }
  const i0 = Math.max(0, from), i1 = Math.min(S.length - 1, to);
  for (let i = i0; i <= i1; i++) {
    const q = S[i];
    if (rectDistance(r, q.x, q.y) < clearance + q.width / 2) return false;
  }
  return true;
}

/** Gruppo di edifici attorno a un punto a lato della strada. */
export interface Cluster { s: number; side: -1 | 1; dist: number }

export function newCluster(s: number, rand: () => number): Cluster {
  // più gruppi vicini alla strada che lontani
  const dist = BUILDING.minDist + 8 + (BUILDING.maxDist - BUILDING.minDist - 18) * rand() ** 1.4;
  return { s, side: rand() < 0.5 ? -1 : 1, dist };
}

/**
 * Prova a piazzare un edificio del gruppo: posizione con un po' di variazione attorno al gruppo,
 * scartata se invade la strada (campioni entro ±scan m). null se nessun tentativo va bene.
 */
export function placeBuilding(track: Track, c: Cluster, rand: () => number, attempts = 6): Placement | null {
  const S = track.samples;
  const last = S.length - 1;
  for (let a = 0; a < attempts; a++) {
    const s = Math.max(0, Math.min(last * STEP, c.s + (rand() - 0.5) * 24));
    const lateral = c.side * Math.max(BUILDING.minDist, Math.min(BUILDING.maxDist, c.dist + (rand() - 0.5) * 20));
    const p = S[Math.min(last, Math.round(s / STEP))];
    const halfW = (BUILDING.minWidth + (BUILDING.maxWidth - BUILDING.minWidth) * rand()) / 2;
    const halfD = (BUILDING.minWidth + (BUILDING.maxWidth - BUILDING.minWidth) * rand()) / 2;
    const r: Footprint = { x: p.x - Math.sin(p.angle) * lateral, y: p.y + Math.cos(p.angle) * lateral, halfW, halfD };
    const i = Math.round(s / STEP);
    if (!clearOfRoad(track, r, i - BUILDING.scan / STEP, i + BUILDING.scan / STEP)) continue;
    // i più vicini tendono a essere più alti, come in un viale di grattacieli
    const near = 1 - (Math.abs(lateral) - BUILDING.minDist) / (BUILDING.maxDist - BUILDING.minDist);
    const h = Math.min(1, rand() * (0.6 + 0.6 * near));
    return { ...r, top: p.elevation + BUILDING.minTop + (BUILDING.maxTop - BUILDING.minTop) * h };
  }
  return null;
}
