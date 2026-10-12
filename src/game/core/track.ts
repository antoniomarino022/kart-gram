import { CONFIG, SPEED_CAP_BIOME, STEP } from "./config";
import { mulberry32, range, type Rng } from "./rng";
import { spawnItems, type Item } from "./items";

export interface TrackSample {
  s: number;
  x: number;
  y: number;
  angle: number;
  width: number;
  elevation: number;
  curvature: number;
}

export interface Track {
  /** Stream RNG della sola geometria. */
  rng: Rng;
  /** Stream RNG separato per gli oggetti: spawnItems on/off non cambia la strada. */
  itemRng: Rng;
  samples: TrackSample[];
  items: Item[];
  nextItemId: number;
  spawnItems: boolean;
}

const WIDTH_BLEND = 5;

export function createTrack(seed: number, opts: { spawnItems?: boolean } = {}): Track {
  const track: Track = {
    rng: mulberry32(seed),
    itemRng: mulberry32((seed ^ 0x9e3779b9) >>> 0),
    samples: [{ s: 0, x: 0, y: 0, angle: Math.PI / 2, width: CONFIG.road.width, elevation: 0, curvature: 0 }],
    items: [],
    nextItemId: 1,
    spawnItems: opts.spawnItems ?? true,
  };
  addSegment(track, CONFIG.road.startStraight, 0, CONFIG.road.width, 0);
  return track;
}

export const trackLength = (t: Track) => t.samples[t.samples.length - 1].s;

function addSegment(track: Track, length: number, curvature: number, width: number, slope: number) {
  const startS = trackLength(track);
  const first = track.samples[track.samples.length - 1];
  let last = first;
  const n = Math.max(1, Math.round(length / STEP));
  for (let i = 1; i <= n; i++) {
    const mid = last.angle + (curvature * STEP) / 2;
    const next: TrackSample = {
      s: last.s + STEP,
      x: last.x + Math.cos(mid) * STEP,
      y: last.y + Math.sin(mid) * STEP,
      angle: last.angle + curvature * STEP,
      width: first.width + (width - first.width) * Math.min(1, i / WIDTH_BLEND),
      elevation: last.elevation + slope * STEP,
      curvature,
    };
    track.samples.push(next);
    last = next;
  }
  return { startS, endS: last.s };
}

function generateNext(track: Track) {
  const rng = track.rng;
  const last = track.samples[track.samples.length - 1];
  const difficulty = Math.floor(last.s / CONFIG.biomeLength);
  const narrow = difficulty >= 1 && rng() < CONFIG.road.narrowChance;
  const width = narrow ? CONFIG.road.narrowWidth : CONFIG.road.width;
  let slope = range(rng, -0.06, 0.06);
  if (last.elevation > 8) slope = -Math.abs(slope);
  if (last.elevation < -8) slope = Math.abs(slope);

  let seg: { startS: number; endS: number } | null = null;
  const straight = rng() < CONFIG.road.straightChance;
  const radius = range(rng, Math.max(CONFIG.curve.absMinRadius, CONFIG.curve.minRadius - Math.max(0, difficulty - SPEED_CAP_BIOME) * 0.5), CONFIG.curve.maxRadius);
  const turnWanted = range(rng, CONFIG.curve.minAngle, CONFIG.curve.maxAngle);
  let sign = rng() < 0.5 ? 1 : -1;
  const straightLen = range(rng, 15, 40);

  if (!straight) {
    const base = Math.PI / 2, lim = CONFIG.curve.headingLimit;
    if (Math.abs(last.angle + sign * turnWanted - base) > lim) sign = -sign;
    const target = Math.max(base - lim, Math.min(base + lim, last.angle + sign * turnWanted));
    const turn = Math.abs(target - last.angle);
    if (turn >= 0.2) seg = addSegment(track, turn * radius, sign / radius, width, slope);
  }
  if (!seg) seg = addSegment(track, straightLen, 0, width, slope);

  if (track.spawnItems && seg.startS >= CONFIG.spawn.safeStart) spawnItems(track, seg.startS, seg.endS, difficulty);
}

export function extendTrack(track: Track, untilS: number) {
  while (trackLength(track) < untilS) generateNext(track);
}

export function sampleAt(track: Track, s: number): TrackSample {
  const S = track.samples;
  const f = Math.max(0, s / STEP);
  const i = Math.min(S.length - 2, Math.floor(f));
  const t = Math.min(1, f - i);
  const a = S[i], b = S[i + 1];
  return {
    s,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: a.angle + (b.angle - a.angle) * t,
    width: a.width + (b.width - a.width) * t,
    elevation: a.elevation + (b.elevation - a.elevation) * t,
    curvature: b.curvature,
  };
}

export function project(track: Track, x: number, y: number, hint: number) {
  const S = track.samples;
  let best = Math.max(0, Math.min(S.length - 1, hint)), bestD = Infinity;
  const from = Math.max(0, hint - 10), to = Math.min(S.length - 1, hint + 40);
  for (let i = from; i <= to; i++) {
    const d = (S[i].x - x) ** 2 + (S[i].y - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  const p = S[best];
  const c = Math.cos(p.angle), sn = Math.sin(p.angle);
  const dx = x - p.x, dy = y - p.y;
  return { index: best, s: p.s + dx * c + dy * sn, lateral: -dx * sn + dy * c, elevation: p.elevation };
}

export function curveSignAt(track: Track, s: number, ahead: number): -1 | 0 | 1 {
  const S = track.samples;
  const from = Math.max(0, Math.floor(s / STEP) + 1);
  const to = Math.min(S.length - 1, Math.floor((s + ahead) / STEP));
  for (let i = from; i <= to; i++) if (S[i].curvature !== 0) return Math.sign(S[i].curvature) as -1 | 1;
  return 0;
}
