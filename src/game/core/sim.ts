import { CONFIG, DT } from "./config";
import { isSolid, itemPosition, type Item, type PowerupKind } from "./items";
import { createTrack, extendTrack, project, sampleAt, type Track } from "./track";

/** Sterzata: +1 = sinistra (l'angolo cresce), -1 = destra, 0 = dritto. */
export type Steer = -1 | 0 | 1;

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
  | { type: "biome"; index: number }
  | { type: "boost" };

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
  /** Secondi di boost rimasti (pedane). */
  boostTimer: number;
  /** Ghiaccio: secondi di scivolata rimasti dopo il rilascio. */
  slideTimer: number;
  powerups: Record<PowerupKind, number>;
  upgrades: UpgradeLevels;
  revived: boolean;
  biome: number;
  /** Ultima sterzata diversa da 0 (per l'olio, la scivolata sul ghiaccio e il renderer). */
  lastSteer: -1 | 1;
  events: GameEvent[];
}

const TIMED: Exclude<PowerupKind, "shield">[] = ["turbo", "magnet", "wide", "slowmo", "x2"];

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
    boostTimer: 0,
    slideTimer: 0,
    powerups: { turbo: 0, shield: 0, magnet: 0, wide: 0, slowmo: 0, x2: 0 },
    upgrades: { ...upgrades },
    revived: false,
    biome: 0,
    lastSteer: 1,
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
  st.slideTimer = 0;
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

/** Il kart è sulla pedana: dentro il tratto e (se la pedana è mezza strada) dalla parte giusta. */
function onBoostPad(st: GameState, it: Item) {
  const k = st.kart;
  if (k.s < it.s || k.s > it.s + it.length) return false;
  if (it.lateral === 0) return true;
  const half = sampleAt(st.track, k.s).width / 2;
  return Math.sign(k.lateral) === Math.sign(it.lateral) && Math.abs(k.lateral) >= CONFIG.boost.minInside && Math.abs(k.lateral) <= half;
}

function surface(st: GameState) {
  const k = st.kart;
  let ice = false, oil = false;
  for (const it of st.track.items) {
    if (it.consumed) continue;
    if (it.kind === "boost") {
      if (onBoostPad(st, it)) {
        st.boostTimer = CONFIG.boost.duration;
        if (!it.entered) { it.entered = true; st.events.push({ type: "boost" }); }
      }
    } else if (it.kind === "ice" && k.s >= it.s && k.s <= it.s + it.length) ice = true;
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
    if (ds > reach || it.kind === "ice" || it.kind === "oil" || it.kind === "boost") continue;
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

export function step(st: GameState, steer: Steer): GameState {
  st.events = [];
  if (st.phase === "over") return st;
  st.tick++;
  const k = st.kart;
  const dt = DT * (st.powerups.slowmo > 0 ? CONFIG.slowmoTimeScale : 1);

  for (const p of TIMED) st.powerups[p] = Math.max(0, st.powerups[p] - DT);
  st.slowTimer = Math.max(0, st.slowTimer - DT);
  st.invulnTimer = Math.max(0, st.invulnTimer - DT);
  st.boostTimer = Math.max(0, st.boostTimer - DT);

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

  const { ice, oil } = surface(st);

  let speed = Math.min(CONFIG.speed.max, CONFIG.speed.base + CONFIG.speed.perBiome * biome);
  if (st.powerups.turbo > 0) speed *= CONFIG.turboSpeedFactor;
  if (st.boostTimer > 0) speed *= CONFIG.boost.speedFactor;
  if (st.slowTimer > 0) speed *= CONFIG.hitSlowdown.factor;
  k.speed = speed;

  // la strada non decide nulla: si gira solo con la sterzata (o sull'olio), altrimenti si va dritti
  if (steer !== 0) st.lastSteer = steer;
  const drifting = steer !== 0 || oil;
  const turnRate = (speed / CONFIG.turnRadius) * (ice ? CONFIG.iceGrip : 1);
  if (drifting) {
    k.angle += (steer || st.lastSteer) * turnRate * dt;
    st.slideTimer = CONFIG.iceSlide;
  } else {
    // sul ghiaccio il kart continua a scivolare per un attimo nella direzione dell'ultima sterzata
    if (ice && st.slideTimer > 0) k.angle += st.lastSteer * turnRate * (st.slideTimer / CONFIG.iceSlide) * dt;
    st.slideTimer = Math.max(0, st.slideTimer - DT);
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
  for (const it of st.track.items) if (it.s >= st.kart.s && it.s <= st.kart.s + 25 && it.kind !== "coin" && it.kind !== "powerup" && it.kind !== "boost") it.consumed = true;
  st.phase = "running";
  st.revived = true;
  st.invulnTimer = CONFIG.invulnAfterRevive;
  return true;
}

export function simulate(
  seed: number,
  inputs: [number, Steer][],
  opts: { upgrades?: UpgradeLevels; revived?: boolean; maxTicks?: number } = {},
): GameState {
  const st = createGame(seed, opts.upgrades);
  const max = opts.maxTicks ?? CONFIG.maxTicks;
  let steer: Steer = 0, i = 0;
  while (st.tick < max) {
    while (i < inputs.length && inputs[i][0] <= st.tick) { steer = inputs[i][1]; i++; }
    step(st, steer);
    if (st.phase === "over") {
      if (opts.revived && !st.revived) revive(st);
      else break;
    }
  }
  return st;
}
