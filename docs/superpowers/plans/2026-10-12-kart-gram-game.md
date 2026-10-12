# kart-gram Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete client-side kart-gram game: an endless one-tap 3D drift game (Telegram Mini App, portrait) with obstacles, power-ups, score/combo, customization, shop, and a swappable backend (mock/remote).

**Architecture:** Deterministic pure-TS simulation in `src/game/core` (fixed 60 Hz tick, seeded RNG, replayable from `seed + inputs`). three.js renderer in `src/game/render` reads state only. A `Game` controller runs the loop outside React; React (`src/ui`) only renders screens and listens to events. All backend access goes through `src/backend` (interface + mock in localStorage + remote HTTP), selected by `NEXT_PUBLIC_BACKEND`.

**Tech Stack:** Next.js 16.4 (App Router), React 19.3, TypeScript 5, Tailwind 4, three.js (vanilla), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-kart-gram-game-design.md` — read it before starting any task.

## Global Constraints

- All source under `src/`; import alias `@/*` → `./src/*`.
- `src/game/core/**` MUST NOT import `three`, `react`, or touch `window`/`document`. Pure, deterministic. No `Math.random()` and no `Date.now()` in core.
- Core coordinates: 2D plane `(x, y)`, heading `angle` in radians, direction `(cos angle, sin angle)`. Start heading is `Math.PI / 2`. Positive `lateral` = left of track direction. Positive curvature = left turn.
- three.js mapping: `three.x = core.x`, `three.z = -core.y`, `three.y = elevation`; model yaw `rotation.y = angle - Math.PI / 2` (models face -Z).
- Model files: `public/models/<name>.glb`, 1 unit = 1 m, +Y up, front faces -Z, origin at base. Kart models have NO wheels (wheels are separate `wheel_*.glb`, attached by the renderer). Kart paintable meshes use a material named `paint`.
- React never calls `setState` at 60 Hz. HUD polls a snapshot at ~10 Hz.
- Next.js in this repo is 16.4 with breaking changes; if you touch Next-specific APIs, read the relevant file under `node_modules/next/dist/docs/01-app/` first. `next/dynamic` with `ssr: false` is only allowed inside Client Components.
- Env: `NEXT_PUBLIC_BACKEND` (`mock`|`remote`), `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MOCK_COINS`. Reference them as literal `process.env.NEXT_PUBLIC_X` (Next inlines only literal accesses).
- In mock mode Stars purchases are FREE: item granted immediately.
- UI copy in Italian.
- Commit after each task. Commit messages in Italian, format `Categoria: descrizione breve` (e.g. `Core: simulazione deterministica`, `Backend: mock localStorage`, `Render: ...`, `UI: ...`, `Asset: ...`, `Fix: ...`). NO `Co-Authored-By` or any AI attribution lines. Author stays the configured git user (BuldiDev).
- Commands are run from the repo root `C:\Users\balda\Desktop\Codice\kart-gram` (shell: Git Bash or PowerShell).

## File Map

```
src/game/core/config.ts      tuning constants
src/game/core/rng.ts         mulberry32 + helpers
src/game/core/track.ts       road generation, sampling, projection
src/game/core/items.ts       item types, spawning, item positions
src/game/core/sim.ts         GameState, step(), revive(), simulate()
src/game/core/*.test.ts      vitest
src/backend/types.ts         contract (Backend interface + DTOs)
src/backend/catalog.ts       default catalog + prices (used by mock)
src/backend/mock.ts          localStorage implementation
src/backend/remote.ts        HTTP implementation
src/backend/index.ts         getBackend() selector
src/backend/purchase.ts      Stars purchase / revive flow helpers
src/telegram/webapp.ts       Telegram WebApp wrapper (no-op outside Telegram)
src/game/input/pointer.ts    touch/mouse/space → pressed
scripts/generate-models.mjs  placeholder .glb generator
public/models/*.glb          generated placeholders
src/game/render/palette.ts   biome palettes + deco model names
src/game/render/models.ts    GLB loading with fallback
src/game/render/trackMesh.ts road ribbon chunks
src/game/render/GameRenderer.ts scene, kart, items, camera, deco, trail
src/game/Game.ts             loop controller (core + render + input + recording)
src/ui/*.tsx                 screens
src/app/page.tsx, layout.tsx shell
```

---

### Task 1: Tooling + RNG + config

**Files:**
- Modify: `package.json` (add deps + `test` script)
- Create: `vitest.config.ts`, `src/game/core/config.ts`, `src/game/core/rng.ts`, `src/game/core/rng.test.ts`

**Interfaces:**
- Produces: `STEP`, `DT`, `TICK_RATE`, `CONFIG`, `SPEED_CAP_BIOME` from `config.ts`; `type Rng`, `mulberry32(seed)`, `range(rng,min,max)`, `pick(rng,arr)` from `rng.ts`.

- [ ] **Step 1: Install deps**

Run: `npm install three && npm install -D vitest @types/three`

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 3: Write failing test `src/game/core/rng.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { mulberry32, pick, range } from "./rng";

describe("mulberry32", () => {
  it("same seed gives same sequence", () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("different seeds differ", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("values in [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it("range and pick", () => {
    const r = mulberry32(3);
    for (let i = 0; i < 100; i++) { const v = range(r, 5, 10); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(10); }
    expect(["a", "b"]).toContain(pick(r, ["a", "b"] as const));
  });
});
```

- [ ] **Step 4: Run `npm test` → FAIL (module not found)**

- [ ] **Step 5: Implement `src/game/core/rng.ts`**

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
```

- [ ] **Step 6: Create `src/game/core/config.ts`**

```ts
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Distanza (m) tra due campioni della strada. */
export const STEP = 1;

export const CONFIG = {
  biomeLength: 1500,
  /** Quanti metri di strada generare davanti al kart. */
  lookAhead: 300,
  speed: { base: 14, perBiome: 2, max: 26 },
  /** Raggio di sterzata in drift: turnRate = speed / turnRadius. Deve essere < curve.absMinRadius. */
  turnRadius: 8,
  /** rad/s: rilasciato, l'heading torna verso la tangente della strada. */
  relaxRate: 0.6,
  iceGrip: 0.7,
  /** Metri davanti in cui cercare la direzione della prossima curva. */
  curveLookAhead: 25,
  kartHalfWidth: 0.5,
  road: { width: 7, narrowWidth: 4.5, wideBonus: 3, startStraight: 60, narrowChance: 0.2, straightChance: 0.4 },
  curve: { minRadius: 12, absMinRadius: 9.5, maxRadius: 24, minAngle: Math.PI / 4, maxAngle: Math.PI / 2, headingLimit: 1.4 },
  spawn: { safeStart: 60, baseSpacing: 30, spacingPerBiome: 3, minSpacing: 12, coinChance: 0.6, powerupChance: 0.15 },
  fallDuration: 1,
  invulnAfterRescue: 1,
  invulnAfterRevive: 2,
  hitSlowdown: { factor: 0.6, duration: 1 },
  turboSpeedFactor: 1.4,
  slowmoTimeScale: 0.6,
  powerupBase: { turbo: 3, magnet: 6, wide: 5, slowmo: 3, x2: 6 },
  upgradePerLevel: { turbo: 0.5, magnet: 1, slowmo: 0.5, x2: 1 },
  magnetRadius: 6,
  pickupRadius: 1.0,
  nearMissMargin: 1.0,
  score: { perMeter: 1, driftPerSecond: 20, perfectLinePerSecond: 30, perfectLineEdge: 1.2, nearMiss: 50, minDrift: 0.5 },
  comboMax: 5,
  comboStep: 3,
  maxTicks: 60 * 60 * 30,
} as const;

/** Bioma dal quale la velocità smette di salire. */
export const SPEED_CAP_BIOME = Math.ceil((CONFIG.speed.max - CONFIG.speed.base) / CONFIG.speed.perBiome);
```

- [ ] **Step 7: Run `npm test` → PASS**

- [ ] **Step 8: Commit** — `git add -A && git commit -m "Core: tooling vitest, rng e config"`

---

### Task 2: Track generation + items spawning

**Files:**
- Create: `src/game/core/track.ts`, `src/game/core/items.ts`, `src/game/core/track.test.ts`

**Interfaces:**
- Consumes: Task 1 (`CONFIG`, `STEP`, `SPEED_CAP_BIOME`, `mulberry32`, `range`, `pick`, `Rng`).
- Produces:
  - `interface TrackSample { s; x; y; angle; width; elevation; curvature: number }`
  - `interface Track { rng: Rng; samples: TrackSample[]; items: Item[]; nextItemId: number; spawnItems: boolean }`
  - `createTrack(seed: number, opts?: { spawnItems?: boolean }): Track`
  - `extendTrack(track, untilS: number): void`, `trackLength(track): number`
  - `sampleAt(track, s): TrackSample` (interpolated, clamped)
  - `project(track, x, y, hintIndex): { index; s; lateral; elevation }`
  - `curveSignAt(track, s, ahead): -1 | 0 | 1`
  - items.ts: `type ObstacleKind = "cone"|"oil"|"ice"|"barrier"|"hole"|"rival"`, `type PowerupKind = "turbo"|"shield"|"magnet"|"wide"|"slowmo"|"x2"`, `const POWERUP_KINDS`, `interface Item { id; kind: ObstacleKind|"coin"|"powerup"; powerup?: PowerupKind; s; lateral; radius; length; speed: number; consumed: boolean; passed: boolean; minDist: number }`, `spawnItems(track, startS, endS, difficulty)`, `itemPosition(track, item): { x; y; elevation; angle }`, `isSolid(item): boolean`.

- [ ] **Step 1: Write failing test `src/game/core/track.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { CONFIG, STEP } from "./config";
import { createTrack, curveSignAt, extendTrack, project, sampleAt, trackLength } from "./track";
import { itemPosition } from "./items";

describe("track", () => {
  it("is deterministic for a seed", () => {
    const a = createTrack(99), b = createTrack(99);
    extendTrack(a, 3000); extendTrack(b, 3000);
    expect(a.samples.length).toBe(b.samples.length);
    expect(a.samples[2500]).toEqual(b.samples[2500]);
    expect(a.items).toEqual(b.items);
  });

  it("does not depend on how it was extended", () => {
    const a = createTrack(5), b = createTrack(5);
    extendTrack(a, 2000);
    for (let s = 100; s <= 2000; s += 37) extendTrack(b, s);
    const n = Math.min(a.samples.length, b.samples.length);
    expect(a.samples.slice(0, n)).toEqual(b.samples.slice(0, n));
  });

  it("is continuous with 1m steps and starts straight", () => {
    const t = createTrack(1); extendTrack(t, 5000);
    for (let i = 1; i < t.samples.length; i++) {
      const a = t.samples[i - 1], b = t.samples[i];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(STEP, 2);
      expect(b.s - a.s).toBeCloseTo(STEP, 5);
    }
    for (let i = 0; i < CONFIG.road.startStraight; i++) expect(t.samples[i].curvature).toBe(0);
    expect(trackLength(t)).toBeGreaterThanOrEqual(5000);
  });

  it("keeps heading within limits so the road never loops back", () => {
    const t = createTrack(3); extendTrack(t, 20000);
    for (const p of t.samples) expect(Math.abs(p.angle - Math.PI / 2)).toBeLessThanOrEqual(CONFIG.curve.headingLimit + 0.05);
  });

  it("curves are never tighter than absMinRadius", () => {
    const t = createTrack(4); extendTrack(t, 20000);
    for (const p of t.samples) if (p.curvature !== 0) expect(1 / Math.abs(p.curvature)).toBeGreaterThanOrEqual(CONFIG.curve.absMinRadius - 1e-6);
  });

  it("projects a point back to s and lateral", () => {
    const t = createTrack(8); extendTrack(t, 500);
    const p = sampleAt(t, 200.5);
    const lat = 1.5;
    const x = p.x - Math.sin(p.angle) * lat, y = p.y + Math.cos(p.angle) * lat;
    const r = project(t, x, y, 190);
    expect(r.s).toBeCloseTo(200.5, 0);
    expect(r.lateral).toBeCloseTo(lat, 1);
  });

  it("curveSignAt finds the next curve direction", () => {
    const t = createTrack(2); extendTrack(t, 1000);
    const i = t.samples.findIndex((p) => p.curvature !== 0);
    expect(curveSignAt(t, i - 5, 25)).toBe(Math.sign(t.samples[i].curvature));
  });

  it("spawns no items in the safe start and keeps obstacles spaced", () => {
    const t = createTrack(11); extendTrack(t, 6000);
    expect(t.items.length).toBeGreaterThan(20);
    for (const it of t.items) expect(it.s).toBeGreaterThanOrEqual(CONFIG.spawn.safeStart);
    const obstacles = t.items.filter((i) => i.kind !== "coin" && i.kind !== "powerup").sort((a, b) => a.s - b.s);
    for (let i = 1; i < obstacles.length; i++) expect(obstacles[i].s - obstacles[i - 1].s).toBeGreaterThanOrEqual(6);
  });

  it("holes and barriers always leave at least 2.5m of free road", () => {
    const t = createTrack(12); extendTrack(t, 15000);
    for (const it of t.items.filter((i) => i.kind === "hole" || i.kind === "barrier")) {
      const w = sampleAt(t, it.s).width;
      const free = w / 2 - (Math.abs(it.lateral) - it.radius) ; // lato opposto: da -w/2 al bordo dell'ostacolo
      expect(w - 2 * it.radius).toBeGreaterThanOrEqual(2.5);
      expect(free).toBeGreaterThanOrEqual(0);
    }
  });

  it("itemPosition puts the item at its lateral offset", () => {
    const t = createTrack(13); extendTrack(t, 2000);
    const it = t.items[0];
    const pos = itemPosition(t, it);
    const r = project(t, pos.x, pos.y, Math.floor(it.s) - 5);
    expect(r.lateral).toBeCloseTo(it.lateral, 1);
  });
});
```

- [ ] **Step 2: Run `npm test` → FAIL**

- [ ] **Step 3: Implement `src/game/core/items.ts`**

```ts
import { CONFIG } from "./config";
import { pick, range, type Rng } from "./rng";
import { sampleAt, type Track } from "./track";

export type ObstacleKind = "cone" | "oil" | "ice" | "barrier" | "hole" | "rival";
export type PowerupKind = "turbo" | "shield" | "magnet" | "wide" | "slowmo" | "x2";
export const POWERUP_KINDS: readonly PowerupKind[] = ["turbo", "shield", "magnet", "wide", "slowmo", "x2"];

export interface Item {
  id: number;
  kind: ObstacleKind | "coin" | "powerup";
  powerup?: PowerupKind;
  /** Progresso lungo la strada (m). Per i rival cambia nel tempo. */
  s: number;
  lateral: number;
  radius: number;
  /** Lunghezza della chiazza (solo ice). */
  length: number;
  /** Velocità (m/s), solo rival. */
  speed: number;
  /** Raccolto / colpito: il renderer lo nasconde. */
  consumed: boolean;
  /** Già superato dal kart (near-miss valutato). */
  passed: boolean;
  /** Distanza minima registrata dal kart (per il near-miss). */
  minDist: number;
}

export const isSolid = (it: Item) => it.kind === "cone" || it.kind === "barrier" || it.kind === "rival";

function add(track: Track, partial: Partial<Item> & Pick<Item, "kind" | "s" | "lateral" | "radius">) {
  track.items.push({ id: track.nextItemId++, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity, ...partial });
}

function pickObstacle(rng: Rng, difficulty: number, isCurve: boolean, width: number): ObstacleKind {
  const full = width >= CONFIG.road.width;
  const pool: [ObstacleKind, number][] = [
    ["cone", 30],
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
  const rng = track.rng;
  const isCurve = sampleAt(track, (startS + endS) / 2).curvature !== 0;
  const spacing = Math.max(CONFIG.spawn.minSpacing, CONFIG.spawn.baseSpacing - difficulty * CONFIG.spawn.spacingPerBiome);

  // ostacoli
  let s = startS + range(rng, 4, spacing);
  while (s < endS - 2) {
    const w = sampleAt(track, s).width;
    const kind = pickObstacle(rng, difficulty, isCurve, w);
    switch (kind) {
      case "cone": add(track, { kind, s, lateral: range(rng, -w / 2 + 0.6, w / 2 - 0.6), radius: 0.4 }); break;
      case "oil": add(track, { kind, s, lateral: range(rng, -w / 2 + 1.2, w / 2 - 1.2), radius: 1.2 }); break;
      case "ice": add(track, { kind, s, lateral: 0, radius: 0, length: 12 }); break;
      case "barrier": add(track, { kind, s, lateral: side(rng) * (w / 2 - 1.5), radius: 1.5 }); break;
      case "hole": add(track, { kind, s, lateral: side(rng) * (w / 2 - 1.3), radius: 1.3 }); break;
      case "rival": add(track, { kind, s, lateral: range(rng, -w / 2 + 1, w / 2 - 1), radius: 0.7, speed: range(rng, 8, 11) }); break;
    }
    s += Math.max(6, range(rng, spacing * 0.7, spacing * 1.3));
  }

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
    add(track, { kind: "powerup", powerup: pick(rng, POWERUP_KINDS), s: ps, lateral: range(rng, -w / 2 + 1.2, w / 2 - 1.2), radius: 0.6 });
  }
}

export function itemPosition(track: Track, it: Item) {
  const p = sampleAt(track, it.s);
  return { x: p.x - Math.sin(p.angle) * it.lateral, y: p.y + Math.cos(p.angle) * it.lateral, elevation: p.elevation, angle: p.angle };
}
```

- [ ] **Step 4: Implement `src/game/core/track.ts`**

```ts
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
  rng: Rng;
  samples: TrackSample[];
  items: Item[];
  nextItemId: number;
  spawnItems: boolean;
}

const WIDTH_BLEND = 5;

export function createTrack(seed: number, opts: { spawnItems?: boolean } = {}): Track {
  const track: Track = {
    rng: mulberry32(seed),
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
```

Note: the RNG call order in `generateNext` is fixed (all `rng()` calls happen unconditionally before branching) — keep it that way, it is what makes `extendTrack` order-independent.

- [ ] **Step 5: Run `npm test` → PASS.** If the "holes and barriers" or spacing test fails, fix the spawner (not the test).

- [ ] **Step 6: Commit** — `git commit -am "Core: generazione strada e oggetti" ` (use `git add -A` first)

---

### Task 3: Simulation (step / revive / simulate)

**Files:**
- Create: `src/game/core/sim.ts`, `src/game/core/sim.test.ts`

**Interfaces:**
- Consumes: Task 1–2.
- Produces:
  - `type UpgradeId = "turbo" | "magnet" | "slowmo" | "x2"`, `type UpgradeLevels = Record<UpgradeId, number>`, `NO_UPGRADES`
  - `type GameEvent = {type:"coin"} | {type:"powerup"; kind: PowerupKind} | {type:"hit"} | {type:"smash"} | {type:"nearMiss"} | {type:"driftEnd"; seconds:number; points:number} | {type:"fall"} | {type:"shieldUsed"} | {type:"gameover"} | {type:"biome"; index:number}`
  - `interface Kart { x; y; angle; speed; s; lateral; index; elevation; fallDepth: number; drifting: boolean }`
  - `interface GameState { tick; track; kart; phase: "running"|"falling"|"over"; fallTimer; score; coins; comboPoints; combo; driftTime; slowTimer; invulnTimer; powerups: Record<PowerupKind, number>; upgrades; revived; biome; lastCurveSign; events: GameEvent[] }`
  - `createGame(seed, upgrades?, opts?: { spawnItems?: boolean }): GameState`
  - `step(state, pressed: boolean): GameState` (mutates and returns state; `state.events` holds this tick's events)
  - `revive(state): boolean`
  - `simulate(seed, inputs: [number, boolean][], opts?: { upgrades?; revived?: boolean; maxTicks?: number }): GameState`
  - `finalScore(state): number` = `Math.floor(state.score)`

- [ ] **Step 1: Write failing test `src/game/core/sim.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame, finalScore, revive, simulate, step, type GameState } from "./sim";
import { curveSignAt, sampleAt } from "./track";

/** Bot semplice: punta a un punto 6m avanti sulla linea centrale. */
function botPressed(st: GameState) {
  const k = st.kart;
  const target = sampleAt(st.track, k.s + 6);
  const aim = Math.atan2(target.y - k.y, target.x - k.x);
  const err = Math.atan2(Math.sin(aim - k.angle), Math.cos(aim - k.angle));
  const sign = curveSignAt(st.track, k.s, CONFIG.curveLookAhead) || st.lastCurveSign;
  return err * sign > 0.01;
}

function runBot(seed: number, ticks: number, opts?: { spawnItems?: boolean }) {
  const st = createGame(seed, undefined, opts);
  const inputs: [number, boolean][] = [];
  let last = false;
  while (st.tick < ticks && st.phase !== "over") {
    const p = botPressed(st);
    if (p !== last) { inputs.push([st.tick, p]); last = p; }
    step(st, p);
  }
  return { st, inputs };
}

describe("sim", () => {
  it("with no input the kart drives the start straight then falls at the first curve", () => {
    const st = createGame(1);
    let fell = false;
    for (let i = 0; i < 60 * 30 && st.phase !== "over"; i++) { step(st, false); if (st.events.some((e) => e.type === "fall")) fell = true; }
    expect(fell).toBe(true);
    expect(st.kart.s).toBeGreaterThan(CONFIG.road.startStraight - 5);
    expect(st.phase).toBe("over");
  });

  it("the road is drivable: a bot without items survives 3000m on several seeds", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { st } = runBot(seed, 60 * 60 * 5, { spawnItems: false });
      expect(st.kart.s, `seed ${seed}`).toBeGreaterThan(3000);
    }
  });

  it("speed increases with biome and caps", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    const speeds: number[] = [];
    while (st.kart.s < CONFIG.biomeLength * 2 + 10 && st.phase === "running") {
      step(st, botPressed(st));
      speeds.push(st.kart.speed);
    }
    expect(speeds.at(-1)!).toBeGreaterThan(speeds[0]);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1]);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(CONFIG.speed.max);
  });

  it("golden replay: same seed + inputs = same score", () => {
    const { st, inputs } = runBot(42, 60 * 90);
    const replay = simulate(42, inputs, { maxTicks: st.tick });
    expect(finalScore(replay)).toBe(finalScore(st));
    expect(replay.coins).toBe(st.coins);
    expect(finalScore(st)).toBeGreaterThan(0);
  });

  it("score grows with distance and combo stays within 1..5", () => {
    const { st } = runBot(7, 60 * 60);
    expect(st.score).toBeGreaterThan(st.kart.s * 0.9);
    expect(st.combo).toBeGreaterThanOrEqual(1);
    expect(st.combo).toBeLessThanOrEqual(CONFIG.comboMax);
  });

  it("drift longer than minDrift gives a driftEnd event and combo points", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    for (let i = 0; i < 32; i++) step(st, true); // ~0.53s di drift (più a lungo uscirebbe di strada)
    step(st, false);
    expect(st.events.some((e) => e.type === "driftEnd")).toBe(true);
    expect(st.comboPoints).toBe(1);
  });

  it("hitting a cone slows down and resets combo; turbo smashes instead", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    st.comboPoints = 6;
    st.track.items.push({ id: 999, kind: "cone", s: 10, lateral: 0, radius: 0.4, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity });
    let hit = false;
    for (let i = 0; i < 60 && !hit; i++) { step(st, false); hit = st.events.some((e) => e.type === "hit"); }
    expect(hit).toBe(true);
    expect(st.comboPoints).toBe(0);
    expect(st.slowTimer).toBeGreaterThan(0);

    const st2 = createGame(1, undefined, { spawnItems: false });
    st2.powerups.turbo = 5;
    st2.track.items.push({ id: 998, kind: "cone", s: 10, lateral: 0, radius: 0.4, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity });
    let smash = false;
    for (let i = 0; i < 60 && !smash; i++) { step(st2, false); smash = st2.events.some((e) => e.type === "smash"); }
    expect(smash).toBe(true);
  });

  it("powerup pickup activates with upgraded duration", () => {
    const st = createGame(1, { turbo: 0, magnet: 2, slowmo: 0, x2: 0 }, { spawnItems: false });
    st.track.items.push({ id: 997, kind: "powerup", powerup: "magnet", s: 8, lateral: 0, radius: 0.6, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity });
    for (let i = 0; i < 60 && st.powerups.magnet === 0; i++) step(st, false);
    expect(st.powerups.magnet).toBeGreaterThan(CONFIG.powerupBase.magnet + 1.5);
  });

  it("shield saves from one fall", () => {
    const st = createGame(1);
    st.powerups.shield = 1;
    let used = false;
    for (let i = 0; i < 60 * 30 && st.phase === "running" && !used; i++) { step(st, false); used = st.events.some((e) => e.type === "shieldUsed"); }
    expect(used).toBe(true);
    expect(st.phase).toBe("running");
    expect(Math.abs(st.kart.lateral)).toBeLessThan(0.01);
  });

  it("revive works once and replay with revived matches", () => {
    const seed = 9;
    const st = createGame(seed);
    const inputs: [number, boolean][] = [];
    while (st.phase !== "over") step(st, false);
    expect(revive(st)).toBe(true);
    expect(st.phase).toBe("running");
    let last = false;
    while (st.phase !== "over" && st.tick < 60 * 120) {
      const p = botPressed(st);
      if (p !== last) { inputs.push([st.tick, p]); last = p; }
      step(st, p);
    }
    expect(revive(st)).toBe(false);
    const replay = simulate(seed, inputs, { revived: true, maxTicks: st.tick });
    expect(finalScore(replay)).toBe(finalScore(st));
  });
});
```

- [ ] **Step 2: Run `npm test` → FAIL**

- [ ] **Step 3: Implement `src/game/core/sim.ts`**

```ts
import { CONFIG, DT } from "./config";
import { isSolid, itemPosition, type PowerupKind } from "./items";
import { createTrack, curveSignAt, extendTrack, project, sampleAt, type Track } from "./track";

export type UpgradeId = "turbo" | "magnet" | "slowmo" | "x2";
export type UpgradeLevels = Record<UpgradeId, number>;
export const NO_UPGRADES: UpgradeLevels = { turbo: 0, magnet: 0, slowmo: 0, x2: 0 };

export type GameEvent =
  | { type: "coin" }
  | { type: "powerup"; kind: PowerupKind }
  | { type: "hit" }
  | { type: "smash" }
  | { type: "nearMiss" }
  | { type: "driftEnd"; seconds: number; points: number }
  | { type: "fall" }
  | { type: "shieldUsed" }
  | { type: "gameover" }
  | { type: "biome"; index: number };

export interface Kart {
  x: number; y: number; angle: number; speed: number;
  s: number; lateral: number; index: number; elevation: number;
  /** Metri di caduta (solo in phase "falling"), per il renderer. */
  fallDepth: number;
  drifting: boolean;
}

export interface GameState {
  tick: number;
  track: Track;
  kart: Kart;
  phase: "running" | "falling" | "over";
  fallTimer: number;
  score: number;
  coins: number;
  comboPoints: number;
  combo: number;
  driftTime: number;
  slowTimer: number;
  invulnTimer: number;
  powerups: Record<PowerupKind, number>;
  upgrades: UpgradeLevels;
  revived: boolean;
  biome: number;
  lastCurveSign: number;
  events: GameEvent[];
}

const TIMED: Exclude<PowerupKind, "shield">[] = ["turbo", "magnet", "wide", "slowmo", "x2"];
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createGame(seed: number, upgrades: UpgradeLevels = NO_UPGRADES, opts: { spawnItems?: boolean } = {}): GameState {
  const track = createTrack(seed, opts);
  extendTrack(track, CONFIG.lookAhead);
  return {
    tick: 0,
    track,
    kart: { x: 0, y: 0, angle: Math.PI / 2, speed: CONFIG.speed.base, s: 0, lateral: 0, index: 0, elevation: 0, fallDepth: 0, drifting: false },
    phase: "running",
    fallTimer: 0,
    score: 0,
    coins: 0,
    comboPoints: 0,
    combo: 1,
    driftTime: 0,
    slowTimer: 0,
    invulnTimer: 0,
    powerups: { turbo: 0, shield: 0, magnet: 0, wide: 0, slowmo: 0, x2: 0 },
    upgrades: { ...upgrades },
    revived: false,
    biome: 0,
    lastCurveSign: 1,
    events: [],
  };
}

export const finalScore = (st: GameState) => Math.floor(st.score);

function multiplier(st: GameState) {
  return st.combo * (st.powerups.x2 > 0 ? 2 : 1);
}

function snapToCenter(st: GameState) {
  const k = st.kart;
  const p = sampleAt(st.track, k.s);
  k.x = p.x; k.y = p.y; k.angle = p.angle; k.lateral = 0; k.elevation = p.elevation; k.fallDepth = 0;
  k.drifting = false;
  st.driftTime = 0;
}

function startFall(st: GameState) {
  if (st.powerups.shield > 0) {
    st.powerups.shield = 0;
    snapToCenter(st);
    st.invulnTimer = CONFIG.invulnAfterRescue;
    st.events.push({ type: "shieldUsed" });
    return;
  }
  st.phase = "falling";
  st.fallTimer = CONFIG.fallDuration;
  st.kart.drifting = false;
  st.driftTime = 0;
  st.events.push({ type: "fall" });
}

function activatePowerup(st: GameState, kind: PowerupKind) {
  if (kind === "shield") st.powerups.shield = 1;
  else if (kind === "wide") st.powerups.wide = CONFIG.powerupBase.wide;
  else st.powerups[kind] = CONFIG.powerupBase[kind] + st.upgrades[kind] * CONFIG.upgradePerLevel[kind];
  st.events.push({ type: "powerup", kind });
}

function surface(st: GameState) {
  const k = st.kart;
  let ice = false, oil = false;
  for (const it of st.track.items) {
    if (it.consumed) continue;
    if (it.kind === "ice" && k.s >= it.s && k.s <= it.s + it.length) ice = true;
    else if (it.kind === "oil" && Math.abs(it.s - k.s) < 3) {
      const p = itemPosition(st.track, it);
      if (Math.hypot(p.x - k.x, p.y - k.y) < it.radius) oil = true;
    }
  }
  return { ice, oil };
}

function handleItems(st: GameState, dt: number) {
  const k = st.kart;
  const protectedNow = st.powerups.turbo > 0 || st.invulnTimer > 0;
  for (const it of st.track.items) {
    if (it.kind === "rival" && !it.consumed && it.s - k.s < 120) it.s += it.speed * dt;
    if (it.consumed || it.passed) continue;
    const ds = it.s - k.s;
    if (ds < -2) {
      it.passed = true;
      if (isSolid(it) && it.minDist < it.radius + CONFIG.kartHalfWidth + CONFIG.nearMissMargin) {
        st.score += CONFIG.score.nearMiss * multiplier(st);
        st.comboPoints++;
        st.events.push({ type: "nearMiss" });
      }
      continue;
    }
    const reach = it.kind === "coin" && st.powerups.magnet > 0 ? CONFIG.magnetRadius + 1 : 3;
    if (ds > reach || it.kind === "ice" || it.kind === "oil") continue;
    const p = itemPosition(st.track, it);
    const dist = Math.hypot(p.x - k.x, p.y - k.y);

    if (it.kind === "coin") {
      const r = st.powerups.magnet > 0 ? CONFIG.magnetRadius : it.radius + CONFIG.pickupRadius;
      if (dist < r) { it.consumed = true; st.coins++; st.events.push({ type: "coin" }); }
    } else if (it.kind === "powerup") {
      if (dist < it.radius + CONFIG.pickupRadius) { it.consumed = true; activatePowerup(st, it.powerup!); }
    } else if (it.kind === "hole") {
      if (dist < it.radius && !protectedNow) { startFall(st); if (st.phase !== "running") return; }
    } else {
      it.minDist = Math.min(it.minDist, dist);
      if (dist < it.radius + CONFIG.kartHalfWidth) {
        it.consumed = true;
        if (protectedNow) st.events.push({ type: "smash" });
        else {
          st.slowTimer = CONFIG.hitSlowdown.duration;
          st.comboPoints = 0;
          st.events.push({ type: "hit" });
        }
      }
    }
  }
  st.track.items = st.track.items.filter((it) => it.s > k.s - 40);
}

export function step(st: GameState, pressed: boolean): GameState {
  st.events = [];
  if (st.phase === "over") return st;
  st.tick++;
  const k = st.kart;
  const dt = DT * (st.powerups.slowmo > 0 ? CONFIG.slowmoTimeScale : 1);

  for (const p of TIMED) st.powerups[p] = Math.max(0, st.powerups[p] - DT);
  st.slowTimer = Math.max(0, st.slowTimer - DT);
  st.invulnTimer = Math.max(0, st.invulnTimer - DT);

  if (st.phase === "falling") {
    k.x += Math.cos(k.angle) * k.speed * dt;
    k.y += Math.sin(k.angle) * k.speed * dt;
    const t = CONFIG.fallDuration - st.fallTimer;
    k.fallDepth = 0.5 * 9.8 * t * t * 3;
    st.fallTimer -= DT;
    if (st.fallTimer <= 0) { st.phase = "over"; st.events.push({ type: "gameover" }); }
    return st;
  }

  extendTrack(st.track, k.s + CONFIG.lookAhead);
  const biome = Math.floor(k.s / CONFIG.biomeLength);
  if (biome !== st.biome) { st.biome = biome; st.events.push({ type: "biome", index: biome }); }

  let speed = Math.min(CONFIG.speed.max, CONFIG.speed.base + CONFIG.speed.perBiome * biome);
  if (st.powerups.turbo > 0) speed *= CONFIG.turboSpeedFactor;
  if (st.slowTimer > 0) speed *= CONFIG.hitSlowdown.factor;
  k.speed = speed;

  const { ice, oil } = surface(st);
  const drifting = pressed || oil;
  const here = sampleAt(st.track, k.s);
  const sign = (here.curvature !== 0 ? Math.sign(here.curvature) : curveSignAt(st.track, k.s, CONFIG.curveLookAhead)) || st.lastCurveSign;
  st.lastCurveSign = sign;
  if (drifting) k.angle += sign * (speed / CONFIG.turnRadius) * (ice ? CONFIG.iceGrip : 1) * dt;
  else if (!ice) {
    const d = angleDiff(here.angle, k.angle);
    const m = CONFIG.relaxRate * dt;
    k.angle += Math.max(-m, Math.min(m, d));
  }
  k.drifting = drifting;

  k.x += Math.cos(k.angle) * speed * dt;
  k.y += Math.sin(k.angle) * speed * dt;
  const oldS = k.s;
  const pr = project(st.track, k.x, k.y, k.index);
  k.index = pr.index; k.s = pr.s; k.lateral = pr.lateral; k.elevation = pr.elevation;

  const mult = multiplier(st);
  st.score += Math.max(0, k.s - oldS) * CONFIG.score.perMeter * mult;

  if (drifting) st.driftTime += dt;
  else if (st.driftTime > 0) {
    if (st.driftTime >= CONFIG.score.minDrift) {
      const points = st.driftTime * CONFIG.score.driftPerSecond * mult;
      st.score += points;
      st.comboPoints++;
      st.events.push({ type: "driftEnd", seconds: st.driftTime, points });
    }
    st.driftTime = 0;
  }

  const cur = sampleAt(st.track, k.s);
  const halfWidth = cur.width / 2 + (st.powerups.wide > 0 ? CONFIG.road.wideBonus / 2 : 0);
  if (cur.curvature !== 0 && Math.sign(k.lateral) === Math.sign(cur.curvature) && Math.abs(k.lateral) > halfWidth - CONFIG.score.perfectLineEdge) {
    st.score += CONFIG.score.perfectLinePerSecond * dt * mult;
  }

  handleItems(st, dt);
  if (st.phase === "running" && Math.abs(k.lateral) > halfWidth) startFall(st);

  st.combo = Math.min(CONFIG.comboMax, 1 + Math.floor(st.comboPoints / CONFIG.comboStep));
  return st;
}

export function revive(st: GameState): boolean {
  if (st.phase !== "over" || st.revived) return false;
  snapToCenter(st);
  for (const it of st.track.items) if (it.s >= st.kart.s && it.s <= st.kart.s + 25 && it.kind !== "coin" && it.kind !== "powerup") it.consumed = true;
  st.phase = "running";
  st.revived = true;
  st.invulnTimer = CONFIG.invulnAfterRevive;
  return true;
}

export function simulate(
  seed: number,
  inputs: [number, boolean][],
  opts: { upgrades?: UpgradeLevels; revived?: boolean; maxTicks?: number } = {},
): GameState {
  const st = createGame(seed, opts.upgrades);
  const max = opts.maxTicks ?? CONFIG.maxTicks;
  let pressed = false, i = 0;
  while (st.tick < max) {
    while (i < inputs.length && inputs[i][0] <= st.tick) { pressed = inputs[i][1]; i++; }
    step(st, pressed);
    if (st.phase === "over") {
      if (opts.revived && !st.revived) revive(st);
      else break;
    }
  }
  return st;
}
```

- [ ] **Step 4: Run `npm test` → PASS.** If the "bot survives 3000m" test fails, tune `CONFIG` (e.g. `turnRadius`, `relaxRate`, `curve.*`) — the road MUST be drivable; do not weaken the test. If the falling-kart revive leaves the kart off-track, `snapToCenter` uses `k.s` which is frozen during falling (projection is skipped), so it is the last on-road progress.

- [ ] **Step 5: Run `npx tsc --noEmit` → no errors**

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Core: simulazione deterministica con replay"`

---

### Task 4: Backend contract, catalog, mock, remote

**Files:**
- Create: `src/backend/types.ts`, `src/backend/catalog.ts`, `src/backend/mock.ts`, `src/backend/remote.ts`, `src/backend/index.ts`, `src/backend/mock.test.ts`

**Interfaces:**
- Consumes: `UpgradeId` from `@/game/core/sim`.
- Produces: everything in spec section 5 (`Slot`, `Profile`, `CatalogItem`, `RunResult`, `FinishResult`, `LeaderboardEntry`, `Backend`, `RevivePay = "coins"|"stars"|"owned"`), plus `class BackendError extends Error { status: number }`, `DEFAULT_CATALOG: CatalogItem[]`, `UPGRADE_COSTS = [200, 500, 1000, 2000, 4000]`, `MAX_UPGRADE_LEVEL = 5`, `REVIVE_PRICE = { coins: 500, stars: 5 }`, `DEFAULT_EQUIPPED: Record<Slot,string>`, `createMockBackend(opts: { storage: Pick<Storage,"getItem"|"setItem">; startCoins: number; now?: () => number }): Backend`, `createRemoteBackend(opts: { baseUrl: string; getInitData: () => string; fetchFn?: typeof fetch }): Backend`, `getBackend(): Backend`.

- [ ] **Step 1: `src/backend/types.ts`** — copy the TypeScript block from spec section 5 verbatim (including the extended `CatalogItem` fields), export everything, plus:

```ts
export type RevivePay = "coins" | "stars" | "owned";
export interface FinishResult { newBest: boolean; coinsEarned: number; profile: Profile }
export class BackendError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
```
Use `RevivePay` and `FinishResult` in the `Backend` interface. Import `UpgradeId` from `@/game/core/sim` instead of redeclaring it.

- [ ] **Step 2: `src/backend/catalog.ts`**

```ts
import type { CatalogItem, Slot } from "./types";

export const UPGRADE_COSTS = [200, 500, 1000, 2000, 4000] as const;
export const MAX_UPGRADE_LEVEL = 5;
export const REVIVE_PRICE = { coins: 500, stars: 5 } as const;

export const DEFAULT_EQUIPPED: Record<Slot, string> = {
  kart: "kart_classic", paint: "paint_red", wheels: "wheel_basic", trail: "trail_smoke",
};

const paint = (id: string, name: string, color: string, priceCoins?: number, finish: CatalogItem["finish"] = "flat", priceStars?: number): CatalogItem =>
  ({ id, kind: "paint", name, color, finish, priceCoins, priceStars });

export const DEFAULT_CATALOG: CatalogItem[] = [
  { id: "kart_classic", kind: "kart", name: "Classic", model: "kart_classic.glb", priceCoins: 0 },
  { id: "kart_bolt", kind: "kart", name: "Bolt", model: "kart_bolt.glb", priceCoins: 1000 },
  { id: "kart_brick", kind: "kart", name: "Brick", model: "kart_brick.glb", priceCoins: 3000, priceStars: 25 },
  { id: "kart_rocket", kind: "kart", name: "Rocket", model: "kart_rocket.glb", priceStars: 150 },

  paint("paint_red", "Rosso", "#e63946", 0),
  paint("paint_yellow", "Giallo", "#ffd23f", 300),
  paint("paint_blue", "Blu", "#3a86ff", 300),
  paint("paint_green", "Verde", "#2dc653", 300),
  paint("paint_purple", "Viola", "#8338ec", 300),
  paint("paint_orange", "Arancione", "#fb8500", 300),
  paint("paint_white", "Bianco", "#f1f1f1", 300),
  paint("paint_black", "Nero", "#222222", 300),
  paint("paint_metal", "Metal", "#b8c4cc", 300, "metal"),
  paint("paint_neon", "Neon", "#39ff14", undefined, "neon", 15),

  { id: "wheel_basic", kind: "wheels", name: "Base", model: "wheel_basic.glb", priceCoins: 0 },
  { id: "wheel_sport", kind: "wheels", name: "Sport", model: "wheel_sport.glb", priceCoins: 500 },
  { id: "wheel_offroad", kind: "wheels", name: "Offroad", model: "wheel_offroad.glb", priceCoins: 500 },
  { id: "wheel_retro", kind: "wheels", name: "Retro", model: "wheel_retro.glb", priceCoins: 500 },

  { id: "trail_smoke", kind: "trail", name: "Fumo", color: "#d9d9d9", priceCoins: 0 },
  { id: "trail_fire", kind: "trail", name: "Fiamme", color: "#ff6b1a", priceCoins: 800 },
  { id: "trail_rainbow", kind: "trail", name: "Arcobaleno", color: "#ff00ff", priceStars: 20 },
  { id: "trail_stars", kind: "trail", name: "Stelle", color: "#ffe14d", priceStars: 30 },

  { id: "coins_s", kind: "coin_pack", name: "Sacchetto di monete", coins: 2500, priceStars: 50 },
  { id: "coins_m", kind: "coin_pack", name: "Forziere di monete", coins: 15000, priceStars: 250 },
  { id: "coins_l", kind: "coin_pack", name: "Caveau di monete", coins: 35000, priceStars: 500 },
  { id: "starter_pack", kind: "starter_pack", name: "Starter Pack", priceStars: 49, coins: 2000, revives: 3, grants: ["kart_brick"] },
];
```

- [ ] **Step 3: Write failing test `src/backend/mock.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "./mock";
import { REVIVE_PRICE, UPGRADE_COSTS } from "./catalog";

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("mock backend", () => {
  let storage: ReturnType<typeof memStorage>;
  beforeEach(() => { storage = memStorage(); });
  const make = () => createMockBackend({ storage, startCoins: 5000 });

  it("creates a default profile with starting coins and default items", async () => {
    const p = await make().getProfile();
    expect(p.coins).toBe(5000);
    expect(p.owned).toEqual(expect.arrayContaining(["kart_classic", "paint_red", "wheel_basic", "trail_smoke"]));
    expect(p.equipped.kart).toBe("kart_classic");
    expect(p.bestScore).toBe(0);
  });

  it("persists across instances", async () => {
    await make().buyWithCoins("kart_bolt");
    expect((await make().getProfile()).owned).toContain("kart_bolt");
  });

  it("buys with coins, rejects when too poor or already owned", async () => {
    const b = make();
    const p = await b.buyWithCoins("kart_bolt");
    expect(p.coins).toBe(4000);
    await expect(b.buyWithCoins("kart_bolt")).rejects.toThrow();
    await b.buyWithCoins("kart_brick");
    await expect(b.buyWithCoins("paint_yellow")).resolves.toBeTruthy();
    await expect(b.buyWithCoins("kart_rocket")).rejects.toThrow(); // solo Stars
  });

  it("stars purchases are free and immediate in mock", async () => {
    const b = make();
    const { invoiceLink } = await b.createStarsInvoice("starter_pack");
    expect(invoiceLink.startsWith("mock://")).toBe(true);
    const p = await b.getProfile();
    expect(p.owned).toContain("kart_brick");
    expect(p.coins).toBe(7000);
    expect(p.revives).toBe(3);
  });

  it("equip requires ownership", async () => {
    const b = make();
    await expect(b.equip("kart", "kart_bolt")).rejects.toThrow();
    await b.buyWithCoins("kart_bolt");
    expect((await b.equip("kart", "kart_bolt")).equipped.kart).toBe("kart_bolt");
  });

  it("upgrades cost increasing coins up to level 5", async () => {
    const b = make();
    let p = await b.buyUpgrade("magnet");
    expect(p.upgrades.magnet).toBe(1);
    expect(p.coins).toBe(5000 - UPGRADE_COSTS[0]);
    p = await b.buyUpgrade("magnet");
    expect(p.coins).toBe(5000 - UPGRADE_COSTS[0] - UPGRADE_COSTS[1]);
  });

  it("run lifecycle: best score and coins", async () => {
    const b = make();
    const { runId, seed } = await b.startRun();
    expect(typeof seed).toBe("number");
    const r = await b.finishRun({ runId, score: 1234, distance: 900, coins: 12, durationMs: 60000, revived: false, inputs: [] });
    expect(r.newBest).toBe(true);
    expect(r.coinsEarned).toBe(12);
    expect(r.profile.bestScore).toBe(1234);
    expect(r.profile.coins).toBe(5012);
    const r2 = await b.finishRun({ runId: (await b.startRun()).runId, score: 10, distance: 5, coins: 0, durationMs: 1000, revived: false, inputs: [] });
    expect(r2.newBest).toBe(false);
  });

  it("revive: coins, owned, stars (free)", async () => {
    const b = make();
    const { runId } = await b.startRun();
    expect((await b.revive(runId, "coins")).ok).toBe(true);
    expect((await b.getProfile()).coins).toBe(5000 - REVIVE_PRICE.coins);
    expect((await b.revive(runId, "owned")).ok).toBe(false); // nessun revive posseduto
    expect((await b.revive(runId, "stars")).ok).toBe(true);
  });

  it("leaderboard includes the player", async () => {
    const b = make();
    const { runId } = await b.startRun();
    await b.finishRun({ runId, score: 999999, distance: 1, coins: 0, durationMs: 1, revived: false, inputs: [] });
    const lb = await b.getLeaderboard("global");
    expect(lb[0].score).toBe(999999);
    expect(lb.map((e) => e.rank)).toEqual(lb.map((_, i) => i + 1));
  });
});
```

- [ ] **Step 4: Run `npm test` → FAIL**

- [ ] **Step 5: Implement `src/backend/mock.ts`**

Requirements (all covered by tests above):
- Storage key `kartgram.mock.v1`; JSON `{ profile: Profile; runs: Record<string, { seed: number }> }`.
- Default profile: `userId: "local"`, `name: "Tu"`, `coins: startCoins`, `bestScore: 0`, `owned`: all catalog ids with `priceCoins === 0`, `equipped: DEFAULT_EQUIPPED`, `upgrades: { turbo:0, magnet:0, slowmo:0, x2:0 }`, `revives: 0`.
- Every method returns a deep copy (`structuredClone`) and persists after mutating.
- Errors: throw `new BackendError(400, "<messaggio italiano>")` for: unknown item, already owned, not enough coins, item not buyable with coins (`priceCoins === undefined`), equip not owned / wrong slot, upgrade at max level.
- `startRun`: `seed = Math.floor(Math.random() * 2 ** 31)`, `runId = "mock-" + seed + "-" + now()`.
- `finishRun`: `coinsEarned = r.coins`, add coins, `newBest = r.score > bestScore`, update best.
- `createStarsInvoice(itemId)`: item must have `priceStars`; grant immediately (`grant()` helper: slot items → `owned`; `coin_pack` → `coins += item.coins`; `starter_pack` → `coins += item.coins`, `revives += item.revives`, push `grants` into `owned`); return `{ invoiceLink: "mock://paid/" + itemId }`. Starter pack and slot items can't be bought twice (throw).
- `revive(runId, pay)`: `"coins"` → needs `REVIVE_PRICE.coins`, deduct, `{ok:true}`; `"owned"` → needs `revives > 0`, decrement; `"stars"` → `{ ok: true }` (free).
- `getLeaderboard`: 9 fake entries (names "Luca", "Giulia", "Marco", "Sara", "Ale", "Fede", "Chiara", "Paolo", "Marta", scores 15000 down to 1500 in steps of 1500) + the player (`bestScore`), sorted desc, ranks 1..N.
- `getCatalog`: `structuredClone(DEFAULT_CATALOG)`.

- [ ] **Step 6: Implement `src/backend/remote.ts`**

```ts
import { BackendError, type Backend } from "./types";

export function createRemoteBackend(opts: { baseUrl: string; getInitData: () => string; fetchFn?: typeof fetch }): Backend {
  const f = opts.fetchFn ?? fetch;
  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await f(opts.baseUrl.replace(/\/$/, "") + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `tma ${opts.getInitData()}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new BackendError(res.status, (await res.text().catch(() => "")) || res.statusText);
    return res.json() as Promise<T>;
  }
  return {
    getProfile: () => call("GET", "/profile"),
    getCatalog: () => call("GET", "/catalog"),
    startRun: () => call("POST", "/runs"),
    finishRun: (r) => call("POST", `/runs/${encodeURIComponent(r.runId)}/finish`, r),
    revive: (runId, pay) => call("POST", `/runs/${encodeURIComponent(runId)}/revive`, { pay }),
    equip: (slot, itemId) => call("POST", "/equip", { slot, itemId }),
    buyWithCoins: (itemId) => call("POST", "/shop/coins", { itemId }),
    createStarsInvoice: (itemId) => call("POST", "/shop/stars-invoice", { itemId }),
    buyUpgrade: (upgradeId) => call("POST", "/upgrades", { upgradeId }),
    getLeaderboard: (scope) => call("GET", `/leaderboard?scope=${scope}`),
  };
}
```

- [ ] **Step 7: Implement `src/backend/index.ts`**

```ts
import { createMockBackend } from "./mock";
import { createRemoteBackend } from "./remote";
import type { Backend } from "./types";
import { getInitData } from "@/telegram/webapp";

let instance: Backend | null = null;

export function getBackend(): Backend {
  if (instance) return instance;
  instance = process.env.NEXT_PUBLIC_BACKEND === "remote"
    ? createRemoteBackend({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "", getInitData })
    : createMockBackend({ storage: window.localStorage, startCoins: Number(process.env.NEXT_PUBLIC_MOCK_COINS ?? 5000) });
  return instance;
}

export * from "./types";
```

(`@/telegram/webapp` is created in Task 5; if executing Task 4 first, create a stub `src/telegram/webapp.ts` exporting `export const getInitData = () => "";` — Task 5 replaces it.)

- [ ] **Step 8: Run `npm test` and `npx tsc --noEmit` → PASS**

- [ ] **Step 9: Commit** — `git add -A && git commit -m "Backend: contratto, catalogo, mock e remote"`

---

### Task 5: Telegram wrapper, input, purchase helpers

**Files:**
- Create/replace: `src/telegram/webapp.ts`, `src/game/input/pointer.ts`, `src/backend/purchase.ts`
- Modify: `src/app/layout.tsx` (load Telegram script)

**Interfaces:**
- Produces:
  - `webapp.ts`: `isTelegram(): boolean`, `initTelegram(): void`, `getInitData(): string`, `getTelegramUser(): { id: number; first_name: string } | null`, `haptic(kind: "light" | "medium" | "heavy" | "success" | "error"): void`, `openInvoice(link: string): Promise<"paid" | "cancelled" | "failed" | "pending">`, `onVisibilityChange(cb: (visible: boolean) => void): () => void`.
  - `pointer.ts`: `attachInput(target: HTMLElement, onChange: (pressed: boolean) => void): () => void`
  - `purchase.ts`: `buyWithStars(backend: Backend, itemId: string): Promise<Profile | null>` (null if not paid), `payRevive(backend: Backend, runId: string, pay: RevivePay): Promise<boolean>`

- [ ] **Step 1: `src/telegram/webapp.ts`**

```ts
type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name: string } };
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  isVersionAtLeast?(v: string): boolean;
  setHeaderColor?(c: string): void;
  HapticFeedback?: {
    impactOccurred(s: "light" | "medium" | "heavy"): void;
    notificationOccurred(t: "success" | "error" | "warning"): void;
  };
  openInvoice(url: string, cb: (status: InvoiceStatus) => void): void;
  onEvent?(e: string, cb: () => void): void;
  offEvent?(e: string, cb: () => void): void;
  isActive?: boolean;
}

const tg = (): TgWebApp | null => {
  if (typeof window === "undefined") return null;
  const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return w && w.initData ? w : null;
};

export const isTelegram = () => tg() !== null;

export function initTelegram() {
  const w = tg();
  if (!w) return;
  w.ready();
  w.expand();
  w.disableVerticalSwipes?.();
  if (w.isVersionAtLeast?.("8.0")) w.requestFullscreen?.();
}

export const getInitData = () => tg()?.initData ?? "";
export const getTelegramUser = () => tg()?.initDataUnsafe.user ?? null;

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "error") {
  const h = tg()?.HapticFeedback;
  if (!h) return;
  if (kind === "success" || kind === "error") h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}

export function openInvoice(link: string): Promise<InvoiceStatus> {
  const w = tg();
  if (!w) return Promise.resolve("failed");
  return new Promise((resolve) => w.openInvoice(link, resolve));
}

export function onVisibilityChange(cb: (visible: boolean) => void) {
  const handler = () => cb(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}
```

- [ ] **Step 2: `src/game/input/pointer.ts`**

```ts
export function attachInput(target: HTMLElement, onChange: (pressed: boolean) => void) {
  let pointers = 0, key = false, last = false;
  const emit = () => { const p = pointers > 0 || key; if (p !== last) { last = p; onChange(p); } };
  const down = (e: PointerEvent) => { e.preventDefault(); pointers++; emit(); };
  const up = () => { pointers = Math.max(0, pointers - 1); emit(); };
  const kd = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); key = true; emit(); } };
  const ku = (e: KeyboardEvent) => { if (e.code === "Space") { key = false; emit(); } };
  const reset = () => { pointers = 0; key = false; emit(); };
  const ctx = (e: Event) => e.preventDefault();
  target.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  window.addEventListener("blur", reset);
  target.addEventListener("contextmenu", ctx);
  return () => {
    target.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    window.removeEventListener("blur", reset);
    target.removeEventListener("contextmenu", ctx);
  };
}
```

- [ ] **Step 3: `src/backend/purchase.ts`**

```ts
import { openInvoice } from "@/telegram/webapp";
import type { Backend, Profile, RevivePay } from "./types";

const isMockLink = (l: string) => l.startsWith("mock://");

export async function buyWithStars(backend: Backend, itemId: string): Promise<Profile | null> {
  const { invoiceLink } = await backend.createStarsInvoice(itemId);
  if (!isMockLink(invoiceLink) && (await openInvoice(invoiceLink)) !== "paid") return null;
  return backend.getProfile();
}

export async function payRevive(backend: Backend, runId: string, pay: RevivePay): Promise<boolean> {
  const r = await backend.revive(runId, pay);
  if (!r.ok) return false;
  if (r.invoiceLink && !isMockLink(r.invoiceLink)) return (await openInvoice(r.invoiceLink)) === "paid";
  return true;
}
```

- [ ] **Step 4: Load the Telegram script in `src/app/layout.tsx`** — read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md` first. Add inside `<body>` (root layout):

```tsx
import Script from "next/script";
// ...
<Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
```

- [ ] **Step 5: Run `npx tsc --noEmit`, `npm test`, `npm run build` → all pass**

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Telegram: wrapper Telegram, input e flusso acquisti Stars"`

---

### Task 6: Placeholder 3D models generator

**Files:**
- Create: `scripts/generate-models.mjs`, `public/models/*.glb` (generated, committed)
- Modify: `package.json` (script `"models": "node scripts/generate-models.mjs"`), `README.md` (model list table)

**Interfaces:**
- Produces these files (exact names), all respecting the Global Constraints conventions:
  - Karts (no wheels, body meshes with material named `paint` + details with other materials): `kart_classic` (low flat box body 1.0×0.35×1.6 + seat + steering bar), `kart_bolt` (wedge-like: tapered box + rear spoiler), `kart_brick` (tall boxy body), `kart_rocket` (long body + cylinder "jets" at the back). Footprint ≈ 1.1 m wide × 1.7 m long; body bottom at y=0.15 (wheels are radius 0.22, attached by renderer at (±0.55, 0.22, ±0.6)).
  - Wheels (cylinder rotated to axis X, radius 0.22, width 0.18, centered at origin): `wheel_basic`, `wheel_sport` (thin + colored rim), `wheel_offroad` (wider, radius 0.26), `wheel_retro` (white-wall ring).
  - `rival_kart` (grey kart with wheels included, material not named paint).
  - `obstacle_cone` (orange cone radius 0.35 height 0.7 + white stripe), `obstacle_barrier` (red/white striped box 3.0×0.9×0.4).
  - `coin` (gold cylinder radius 0.35 thickness 0.08, standing up, facing Z).
  - `powerup_turbo` (orange arrow/chevron), `powerup_shield` (blue flattened sphere/icosahedron), `powerup_magnet` (red U from boxes), `powerup_wide` (green wide flat box with arrows), `powerup_slowmo` (purple hourglass: two cones), `powerup_x2` (yellow two cubes) — each ≈ 0.8 m, centered on Y at 0 (renderer lifts and spins them).
  - Decorations (floating weird objects, 3–15 m): `deco_city_1..3` (tall blue boxes/towers), `deco_desert_1..3` (pyramids, arches, cacti from boxes), `deco_ice_1..3` (icosahedron crystals, white cubes), `deco_neon_1..3` (torus rings, magenta/cyan emissive boxes).
- Oil, ice and holes are NOT models (renderer draws flat decals).

- [ ] **Step 1: Write the generator** using `three` + `GLTFExporter` from `three/examples/jsm/exporters/GLTFExporter.js` in Node. Polyfill before importing the exporter:

```js
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = "data:" + (blob.type || "application/octet-stream") + ";base64," + Buffer.from(b).toString("base64"); this.onloadend?.(); this.onload?.({ target: this }); }); }
};
```

Build each model as a `THREE.Group` of meshes with `MeshStandardMaterial({ color, name })` (flat colors, `flatShading: true`), export with `await new GLTFExporter().parseAsync(group, { binary: true })`, write with `fs.writeFileSync(\`public/models/${name}.glb\`, Buffer.from(result))`. One small builder function per model, all in one file, a `MODELS` record `{ [name]: () => THREE.Group }`, and a loop that writes them all and logs each name. Use `mkdirSync(..., { recursive: true })`.

- [ ] **Step 2: Run `npm run models`** → expect one log line per model and the files in `public/models/` (32 files).

- [ ] **Step 3: Verify loading** — add `scripts/check-models.mjs` is NOT needed; instead verify with a quick Node one-off:
Run: `node -e "const fs=require('fs');for(const f of fs.readdirSync('public/models')){const b=fs.readFileSync('public/models/'+f);if(b.toString('ascii',0,4)!=='glTF')throw f;}console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: README** — under "## Modelli 3D" add a table listing every model name, what it is, approximate size, and the notes: kart models have no wheels; meshes to recolor must use material named `paint`; wheel attach points `(±0.55, 0.22, ±0.6)`.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Asset: modelli segnaposto glb e generatore"`

---

### Task 7: Renderer (three.js)

**Files:**
- Create: `src/game/render/palette.ts`, `src/game/render/models.ts`, `src/game/render/trackMesh.ts`, `src/game/render/GameRenderer.ts`

**Interfaces:**
- Consumes: `GameState`, `Kart` (sim), `Track`, `sampleAt` (track), `Item`, `itemPosition` (items), `CatalogItem` (backend types), model files from Task 6.
- Produces:
  - `palette.ts`: `interface BiomePalette { name: string; sky: string; fog: string; road: string; roadEdge: string; stripe: string; deco: string[]; light: number }`, `BIOMES: BiomePalette[]` (4: Sky City sky `#5ab4e6` road `#2f5fd0` edge `#ffd23f`; Desert Void sky `#f4b56a` road `#a0522d`; Ice sky `#cfe9ff` road `#7fb3d5`; Neon Night sky `#14082b` road `#2b1055` edge `#ff2bd6`), `biomeAt(index) = BIOMES[index % BIOMES.length]`.
  - `models.ts`: `loadModels(names: string[]): Promise<ModelLibrary>`; `interface ModelLibrary { get(name: string): THREE.Object3D }` — returns a `.clone(true)`; if a file failed to load, returns a colored fallback box (magenta for unknown) and logs `console.warn` once. Use `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`, URL `/models/${name}.glb`.
  - `GameRenderer`:
    ```ts
    export interface Loadout { kartModel: string; wheelModel: string; paint: { color: string; finish: "flat" | "metal" | "neon" }; trailColor: string; trailId: string }
    export class GameRenderer {
      constructor(canvas: HTMLCanvasElement, models: ModelLibrary, loadout: Loadout)
      resize(): void
      /** prev/curr: pose del kart al tick precedente/corrente; alpha in [0,1] */
      render(state: GameState, prev: { x: number; y: number; angle: number; elevation: number }, alpha: number, frameDt: number): void
      dispose(): void
    }
    ```
    Plus `export const ALL_MODEL_NAMES: string[]` listing every model of Task 6.

- [ ] **Step 1: `palette.ts` and `models.ts`** as specified.

- [ ] **Step 2: `trackMesh.ts`** — `class TrackMeshes { constructor(scene: THREE.Scene); update(track: Track, kartS: number, palette: BiomePalette): void; dispose(): void }`.
  - Builds the road in chunks of 50 samples (chunk k covers samples `[50k, 50k+50]`, sharing the border sample so there are no gaps).
  - Each chunk: a road ribbon (top surface, `BufferGeometry` with 2 vertices per sample at `±width/2` along the normal `(-sin a, cos a)`, mapped to three with `x, elevation, -y`), a slab underneath (sides + bottom, thickness 0.6 m, darker color), and two edge stripes (0.25 m wide, `roadEdge` color, 0.01 m above the road). Plus dashed center line (every other 2 m, white).
  - Chunk color uses the palette of the biome at the chunk start `s`.
  - Keep chunks from `kartS - 30` to `kartS + 250`; dispose geometry of chunks removed.
- [ ] **Step 3: `GameRenderer.ts`**
  - `WebGLRenderer({ canvas, antialias: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, size from `canvas.clientWidth/Height`. `PerspectiveCamera(60, aspect, 0.1, 600)`. `HemisphereLight` + `DirectionalLight`. `scene.fog = new THREE.Fog(palette.fog, 80, 320)`; `scene.background = new THREE.Color(palette.sky)`; on biome change lerp sky/fog colors over ~1 s.
  - Kart: `models.get(kartModel)` + 4 `models.get(wheelModel)` at `(±0.55, 0.22, ±0.6)`; traverse meshes, for materials named `paint` clone and set color; `metal` → `metalness 0.8, roughness 0.3`; `neon` → `emissive` = color, `emissiveIntensity 0.8`. Wheels spin proportional to speed.
  - Kart pose: interpolate `prev` → `state.kart` with `alpha` (angle via shortest arc). Position mapped with the Global Constraints rules, `y = elevation + 0 - kart.fallDepth`. Visual drift: when `kart.drifting`, add a yaw offset of `0.35 * lastCurveSign` rad (eased in/out ~0.15 s) and small roll; when `invulnTimer > 0` or turbo blink/glow.
  - Camera: chase — target point 7 m behind the kart along its (interpolated, smoothed) heading, 3.8 m up; look at a point 8 m ahead and 0.5 m up. Smooth with exponential lerp (`1 - exp(-8*frameDt)`). During `falling` the camera stops following down (keeps last height) so the kart drops out of view.
  - Items: a `Map<number, THREE.Object3D>`; create on first sight within `kartS + 200`, remove when gone from `state.track.items` or `consumed`. Models: `cone`→`obstacle_cone`, `barrier`→`obstacle_barrier` (rotated to face along track), `rival`→`rival_kart` (oriented along track), `coin`→`coin` (spinning), `powerup`→`powerup_<kind>` (floating at y+0.8, spinning, bobbing). Decals (no model): `oil` → black glossy circle radius `item.radius`; `hole` → very dark circle with rim radius `item.radius`; `ice` → light-blue translucent plane covering full width and `item.length` along the track (built from `sampleAt` points). Decals sit 0.02 m above the road. Rivals and all items positioned via `itemPosition` every frame.
  - Floating decorations: render-only (may use `Math.random`), keep ~40 objects from `biomeAt(...).deco` names placed 15–80 m left/right of the track and -20..+30 m vertically, within `kartS - 20 .. kartS + 300`, random rotation, slow rotation animation; recycle ones that fall behind.
  - Trail: when drifting, emit small quads/points behind the rear wheels each frame (pool of ~120), color `trailColor`; `trail_rainbow` cycles hue; `trail_stars` uses small star-ish sprites; fade out over 0.6 s.
  - Turbo: FOV widens to 72 while active (lerp).
  - `dispose()` disposes renderer, geometries, materials.
- [ ] **Step 4: Run `npx tsc --noEmit` and `npm run build` → pass.** (Visual verification happens in Task 9.)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Render: renderer three.js con strada, kart, oggetti e biomi"`

---

### Task 8: Game controller (loop)

**Files:**
- Create: `src/game/Game.ts`

**Interfaces:**
- Consumes: sim (`createGame`, `step`, `revive`, `finalScore`, `GameState`, `GameEvent`, `UpgradeLevels`), `DT`, `GameRenderer`, `Loadout`, `ModelLibrary`, `attachInput`, `haptic`.
- Produces:
  ```ts
  export interface HudSnapshot { score: number; combo: number; coins: number; speed: number; powerups: Record<PowerupKind, number>; drifting: boolean; biome: number }
  export class Game {
    constructor(opts: { canvas: HTMLCanvasElement; models: ModelLibrary; loadout: Loadout; seed: number; upgrades: UpgradeLevels; onEvent: (e: GameEvent) => void })
    start(): void              // starts rAF loop + input
    pause(): void; resume(): void; readonly paused: boolean
    revive(): boolean          // wraps sim revive
    hud(): HudSnapshot
    readonly state: GameState
    /** input changes as [tick, pressed], ready for RunResult.inputs */
    readonly inputs: [number, boolean][]
    readonly durationMs: number   // active (unpaused) play time
    destroy(): void
  }
  ```
- [ ] **Step 1: Implement**
  - Loop: `requestAnimationFrame`; `frameDt = min(0.25, (now - last)/1000)`; when not paused and phase !== "over": `acc += frameDt; while (acc >= DT) { record input; prevPose = copy kart pose; step(state, pressed); dispatch state.events; acc -= DT; }`; then `renderer.render(state, prevPose, acc / DT, frameDt)`. Keep rendering even when paused/over (camera keeps idle).
  - Record input exactly like `simulate` expects: before each `step`, `if (pressed !== lastRecorded) { inputs.push([state.tick, pressed]); lastRecorded = pressed; }`.
  - Events → `onEvent(e)`; haptics: `driftEnd` → light, `hit` → medium, `fall` → heavy, `powerup`/`shieldUsed` → light, `gameover` → error.
  - Auto pause on `visibilitychange` hidden (via `onVisibilityChange`), do not auto-resume.
  - `resize` on `ResizeObserver` of the canvas.
  - `destroy()` cancels rAF, detaches input, disposes renderer.
- [ ] **Step 2: Unit-check replay consistency** — create `src/game/Game.replay.test.ts` that does NOT use three: it reproduces the loop's recording rule with `createGame/step` and random presses (`mulberry32(1)` decides each tick), then asserts `simulate(seed, inputs, {maxTicks})` gives the same `finalScore`. (Guards against changing the recording rule.)
- [ ] **Step 3: `npm test`, `npx tsc --noEmit` → pass**
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Gioco: controller del loop con registrazione input"`

---

### Task 9: UI screens + page integration

**Files:**
- Create: `src/ui/GameApp.tsx`, `src/ui/Hud.tsx`, `src/ui/Menu.tsx`, `src/ui/GameOver.tsx`, `src/ui/Garage.tsx`, `src/ui/Shop.tsx`, `src/ui/Leaderboard.tsx`, `src/ui/PauseOverlay.tsx`, `src/ui/Toast.tsx`, `src/ui/ClientGame.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`, `README.md`

**Interfaces:**
- Consumes: `getBackend`, `buyWithStars`, `payRevive`, `REVIVE_PRICE`, `UPGRADE_COSTS`, `MAX_UPGRADE_LEVEL`, `Game`, `HudSnapshot`, `loadModels`, `ALL_MODEL_NAMES`, `Loadout`, `initTelegram`, `getTelegramUser`, `haptic`, `CatalogItem`, `Profile`.

- [ ] **Step 1: `ClientGame.tsx` + `page.tsx`**
  - `ClientGame.tsx` is `"use client"` and does `const GameApp = dynamic(() => import("./GameApp"), { ssr: false, loading: () => <div className="...">Caricamento…</div> })`.
  - `page.tsx` (server component) renders `<ClientGame />` inside `<main className="relative h-dvh w-full overflow-hidden">`.
- [ ] **Step 2: `GameApp.tsx`** (root state machine)
  - On mount: `initTelegram()`; load `profile`, `catalog` (`Promise.all`) and `loadModels(ALL_MODEL_NAMES)`. Show loading screen until done; on backend error show an error screen with "Riprova".
  - Screens: `"menu" | "playing" | "gameover" | "garage" | "shop" | "leaderboard"`.
  - A single full-screen `<canvas>` stays mounted behind all screens. In menu/garage the last game (or an idle demo game created with a fixed seed and no input, paused after 1 frame) is rendered as background.
  - **Play:** `try { {runId, seed} = await backend.startRun(); unsaved=false } catch { seed = random, runId = "local-"+Date.now(), unsaved = true }` → build `Loadout` from `profile.equipped` + catalog (kart model, wheel model, paint color/finish, trail color/id) → `new Game({...seed, upgrades: profile.upgrades})` → `start()`.
  - **Events:** `gameover` → screen `gameover`. Store `revivedUsed`.
  - **Revive:** `payRevive(backend, runId, pay)` → if true `game.revive()` and back to `playing`; else toast "Pagamento non completato".
  - **Leaving game over** (Riprova / Menu): if not `unsaved`, `backend.finishRun({ runId, score: finalScore(state), distance: Math.floor(state.kart.s), coins: state.coins, durationMs: game.durationMs, revived: state.revived, inputs: game.inputs })`, update profile; on error toast "Partita non salvata". Retry starts a new run immediately.
- [ ] **Step 3: `Hud.tsx`** — polls `game.hud()` with `setInterval(100)`. Top-left: big score + "BEST n" small above (like the reference screenshot); top-right: combo `n×` large italic; under them, active power-up chips with remaining seconds bar. A pause button (top-right corner, 44×44 touch target) → `game.pause()` + `PauseOverlay` (Continua / Esci). The HUD must not capture pointer events except on its buttons (`pointer-events-none` on the container) so tapping anywhere drives the kart.
- [ ] **Step 4: `Menu.tsx`** — logo text "KART-GRAM" (big, italic, bold, outlined), best score, coins, big "GIOCA" button, then row: Garage, Shop, Classifica. Hint text: "Tieni premuto per derapare".
- [ ] **Step 5: `GameOver.tsx`** — score, "NUOVO RECORD!" if score > profile.bestScore, coins collected, distance; if not revived yet: revive buttons "Continua · 500 🪙" (disabled if coins < 500), "Continua · 5 ⭐", "Usa revive (n)" if `profile.revives > 0`; "Riprova", "Menu"; warning "Partita non salvata (offline)" when `unsaved`.
- [ ] **Step 6: `Garage.tsx`** — tabs: Kart, Vernice, Ruote, Scia, Potenziamenti. Item grid cards: name, swatch (paint/trail color) or model name, state (Equipaggiato / Equipaggia / price in 🪙 or ⭐). Buying with coins → `backend.buyWithCoins` then auto-equip; with Stars → `buyWithStars` then `equip`. Potenziamenti tab: 4 rows (Turbo, Magnete, Slow-mo, x2 Score) with level dots (5), next cost, "Migliora" button. Errors → toast with `BackendError.message`.
- [ ] **Step 7: `Shop.tsx`** — Stars items: starter pack (highlighted, hidden if already owned `kart_brick` AND bought — mock throws "già acquistato": just show the toast), coin packs, Stars-only cosmetics. In mock mode show a small badge "Modalità test: Stelle gratis".
- [ ] **Step 8: `Leaderboard.tsx`** — toggle Globale / Settimanale; list rank, name, score; highlight the player (`userId === profile.userId`).
- [ ] **Step 9: Styling** — Tailwind; arcade look: chunky rounded buttons with bottom shadow, italic heavy headings, white text with dark outline (`text-shadow`), panels `bg-black/35 backdrop-blur`. Respect safe areas: `padding-top: max(env(safe-area-inset-top), var(--tg-content-safe-area-inset-top, 0px))` on top HUD. Add needed utilities in `globals.css`. Buttons ≥ 44 px tall.
- [ ] **Step 10: Verify** — `npm run build` passes; then `npm run dev` and check in a browser (use the browser tools available) at a portrait viewport (e.g. 390×844):
  1. Menu appears with background scene.
  2. GIOCA → kart drives; holding mouse/space drifts; HUD updates; falling ends the run.
  3. Game over → revive with ⭐ works (free in mock) → continues; second game over has no revive.
  4. Riprova starts a new run; coins collected are added to profile.
  5. Garage: buy and equip a kart and a paint → next run uses them. Upgrade magnet.
  6. Shop: buy starter pack → coins +2000, revives 3.
  7. Leaderboard shows the player.
  Fix any bug found (follow superpowers:systematic-debugging).
- [ ] **Step 11: README** — update "## Avvio" with controls (tieni premuto / spazio / click) and add a short "## Come si gioca" section.
- [ ] **Step 12: Commit** — `git add -A && git commit -m "UI: schermate, HUD, garage, shop e integrazione pagina"`

---

### Task 10: Final verification

- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` — all must pass; fix issues.
- [ ] Re-read the spec; list any requirement not implemented and implement it or report it.
- [ ] Commit any fixes.
