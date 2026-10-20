import { CONFIG } from "./config";
import { range, type Rng } from "./rng";
import { sampleAt, type Track } from "./track";

export type ObstacleKind = "cone" | "oil" | "ice" | "barrier" | "hole" | "rival" | "barrel";
export type PowerupKind = "turbo" | "shield" | "magnet" | "wide" | "slowmo" | "x2" | "heart" | "ghost" | "shockwave";
export const POWERUP_KINDS: readonly PowerupKind[] = ["shield", "magnet", "wide", "slowmo", "x2", "heart", "ghost", "shockwave"];
/** Peso nello spawn: il cuore (+1 vita) è raro, shockwave è impattante, turbo escluso. */
const POWERUP_WEIGHT: Record<PowerupKind, number> = {
  turbo: 0,
  shield: 2,
  magnet: 2,
  wide: 2,
  slowmo: 2,
  x2: 2,
  heart: 1,
  ghost: 2,
  shockwave: 2,
};
const POWERUP_TOTAL = POWERUP_KINDS.reduce((a, k) => a + POWERUP_WEIGHT[k], 0);

/** Un solo numero dall'RNG, come `pick`: il resto dello stream non cambia. */
function pickPowerup(rng: Rng): PowerupKind {
  let r = rng() * POWERUP_TOTAL;
  for (const k of POWERUP_KINDS) { if ((r -= POWERUP_WEIGHT[k]) < 0) return k; }
  return POWERUP_KINDS[0];
}

export interface Item {
  id: number;
  kind: ObstacleKind | "coin" | "powerup" | "boost";
  powerup?: PowerupKind;
  /** Progresso lungo la strada (m). Per i rival cambia nel tempo. */
  s: number;
  /** Pedana boost: 0 = tutta la strada, altrimenti il segno indica la metà (sinistra > 0). */
  lateral: number;
  /** Pedana boost: mezza larghezza allo spawn (a runtime si usa la larghezza corrente della strada). */
  radius: number;
  /** Lunghezza della chiazza (ice) o della pedana (boost). */
  length: number;
  /** Velocità (m/s), solo rival. */
  speed: number;
  /** Raccolto / colpito: il renderer lo nasconde. */
  consumed: boolean;
  /** Già superato dal kart (near-miss valutato). */
  passed: boolean;
  /** Distanza minima registrata dal kart (per il near-miss). */
  minDist: number;
  /** Pedana boost già presa (l'evento "boost" parte una volta sola). */
  entered?: boolean;
}

const isObstacle = (it: Item) => it.kind !== "coin" && it.kind !== "powerup" && it.kind !== "boost";

export const isSolid = (it: Item) => it.kind === "cone" || it.kind === "barrier" || it.kind === "rival" || it.kind === "barrel";

function add(track: Track, partial: Partial<Item> & Pick<Item, "kind" | "s" | "lateral" | "radius">) {
  track.items.push({ id: track.nextItemId++, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity, ...partial });
}

function pickObstacle(rng: Rng, difficulty: number, isCurve: boolean, width: number): ObstacleKind {
  const full = width >= CONFIG.road.width;
  const pool: [ObstacleKind, number][] = [
    ["cone", 25],
    ["barrel", 15],
    ["oil", 15],
    ["rival", isCurve ? 0 : 15],
    ["barrier", !isCurve && full ? 15 : 0],
    ["hole", difficulty >= 1 && full ? 10 : 0],
    ["ice", difficulty >= 1 ? 10 : 0],
  ];
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [k, w] of pool) { if ((r -= w) < 0) return k; }
  return "cone";
}

const side = (rng: Rng) => (rng() < 0.5 ? -1 : 1);

export function spawnItems(track: Track, startS: number, endS: number, difficulty: number) {
  const rng = track.itemRng;
  const isCurve = sampleAt(track, (startS + endS) / 2).curvature !== 0;
  const spacing = Math.max(CONFIG.spawn.minSpacing, CONFIG.spawn.baseSpacing - difficulty * CONFIG.spawn.spacingPerBiome);

  // ostacoli
  let s = startS + range(rng, 4, spacing);
  while (s < endS - 2) {
    const w = sampleAt(track, s).width;
    const kind = pickObstacle(rng, difficulty, isCurve, w);
    switch (kind) {
      case "cone": add(track, { kind, s, lateral: range(rng, -w / 2 + 0.6, w / 2 - 0.6), radius: 0.4 }); break;
      case "barrel": add(track, { kind, s, lateral: range(rng, -w / 2 + 0.8, w / 2 - 0.8), radius: 0.55 }); break;
      case "oil": add(track, { kind, s, lateral: range(rng, -w / 2 + 1.2, w / 2 - 1.2), radius: 1.2 }); break;
      case "ice": add(track, { kind, s, lateral: 0, radius: 0, length: 12 }); break;
      case "barrier": add(track, { kind, s, lateral: side(rng) * (w / 2 - 1.5), radius: 1.5 }); break;
      case "hole": add(track, { kind, s, lateral: side(rng) * (w / 2 - 1.3), radius: 1.3 }); break;
      case "rival": add(track, { kind, s, lateral: range(rng, -w / 2 + 1, w / 2 - 1), radius: 0.7, speed: range(rng, 8, 11) }); break;
    }
    s += Math.max(6, range(rng, spacing * 0.7, spacing * 1.3));
  }

  // pedana boost sui rettilinei (anche subito dopo una curva), lontana dagli ostacoli
  if (!isCurve && rng() < CONFIG.spawn.boostChance) spawnBoost(track, startS, endS);

  // monete in fila sui rettilinei
  if (!isCurve && rng() < CONFIG.spawn.coinChance) {
    const w = sampleAt(track, startS).width;
    const lateral = range(rng, -w / 2 + 1, w / 2 - 1);
    for (let i = 0; i < 5; i++) {
      const cs = startS + 3 + i * 3;
      if (cs < endS) add(track, { kind: "coin", s: cs, lateral, radius: 0.5 });
    }
  }

  // power-up
  if (rng() < CONFIG.spawn.powerupChance) {
    const ps = range(rng, startS, endS);
    const w = sampleAt(track, ps).width;
    add(track, { kind: "powerup", powerup: pickPowerup(rng), s: ps, lateral: range(rng, -w / 2 + 1.2, w / 2 - 1.2), radius: 0.6 });
  }
}

function spawnBoost(track: Track, startS: number, endS: number) {
  const rng = track.itemRng;
  const { length, clearance, fullWidthChance } = CONFIG.boost;
  const s = startS + range(rng, 0, Math.max(0, endS - startS - length - clearance));
  const w = sampleAt(track, s).width;
  const full = rng() < fullWidthChance;
  const sign = side(rng);
  // via gli ostacoli sulla pedana e a meno di `clearance` m (anche quelli del segmento precedente)
  track.items = track.items.filter((it) => !isObstacle(it) || it.s < s - clearance || it.s > s + length + clearance);
  add(track, { kind: "boost", s, lateral: full ? 0 : (sign * w) / 4, radius: full ? w / 2 : w / 4, length });
}

export function itemPosition(track: Track, it: Item) {
  const p = sampleAt(track, it.s);
  let lateral = it.lateral;
  // il rival tiene la laterale dello spawn: su un tratto stretto resta dentro la strada
  if (it.kind === "rival") {
    const lim = Math.max(0, p.width / 2 - it.radius);
    lateral = Math.max(-lim, Math.min(lim, lateral));
  }
  return { x: p.x - Math.sin(p.angle) * lateral, y: p.y + Math.cos(p.angle) * lateral, elevation: p.elevation, angle: p.angle };
}
