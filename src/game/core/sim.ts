import { CONFIG, DT } from "./config";
import { handleItems, multiplier, startFall, surface } from "./interactions";
import type { PowerupKind } from "./items";
import { slipAngle, steerKart } from "./kartPhysics";
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
  | { type: "lifeLost"; lives: number }
  | { type: "lifeGained"; lives: number }
  | { type: "crash" }
  | { type: "gameover" }
  | { type: "biome"; index: number }
  | { type: "boost" };

export interface Kart {
  x: number; y: number;
  /** Direzione del muso (rad). */
  angle: number;
  /** Direzione di moto (rad): insegue il muso con l'aderenza; la differenza è la derapata. */
  moveAngle: number;
  /** Velocità angolare del muso (rad/s). */
  yawRate: number;
  speed: number;
  s: number; lateral: number; index: number; elevation: number;
  /** Metri di caduta (solo in phase "falling"), per il renderer. */
  fallDepth: number;
  drifting: boolean;
}

export interface GameState {
  tick: number;
  track: Track;
  kart: Kart;
  /** "falling": caduto dalla strada; "crashing": vite finite, il kart si ferma. Entrambe finiscono in "over". */
  phase: "running" | "falling" | "crashing" | "over";
  fallTimer: number;
  /** Perché la partita è finita (null mentre si gioca). */
  endReason: "fall" | "crash" | null;
  lives: number;
  score: number;
  coins: number;
  comboPoints: number;
  combo: number;
  driftTime: number;
  /** Punti di drift accumulati nel drift in corso (pesati dall'angolo di derapata, prima del moltiplicatore). */
  driftPoints: number;
  slowTimer: number;
  invulnTimer: number;
  /** Secondi di boost rimasti (pedane). */
  boostTimer: number;
  powerups: Record<PowerupKind, number>;
  upgrades: UpgradeLevels;
  revived: boolean;
  biome: number;
  /** Ultima sterzata diversa da 0 (per l'olio e il renderer). */
  lastSteer: -1 | 1;
  /** Sensibilità dello sterzo data dalle ruote equipaggiate (CONFIG.wheelSteer). */
  steerSensitivity: number;
  events: GameEvent[];
}

const TIMED: Exclude<PowerupKind, "shield" | "heart">[] = ["turbo", "magnet", "wide", "slowmo", "x2"];

export function createGame(seed: number, upgrades: UpgradeLevels = NO_UPGRADES, opts: { spawnItems?: boolean; wheels?: string } = {}): GameState {
  const track = createTrack(seed, opts);
  extendTrack(track, CONFIG.lookAhead);
  return {
    tick: 0,
    track,
    kart: { x: 0, y: 0, angle: Math.PI / 2, moveAngle: Math.PI / 2, yawRate: 0, speed: CONFIG.speed.base, s: 0, lateral: 0, index: 0, elevation: 0, fallDepth: 0, drifting: false },
    phase: "running",
    fallTimer: 0,
    endReason: null,
    lives: CONFIG.lives,
    score: 0,
    coins: 0,
    comboPoints: 0,
    combo: 1,
    driftTime: 0,
    driftPoints: 0,
    slowTimer: 0,
    invulnTimer: 0,
    boostTimer: 0,
    powerups: { turbo: 0, shield: 0, magnet: 0, wide: 0, slowmo: 0, x2: 0, heart: 0 },
    upgrades: { ...upgrades },
    revived: false,
    biome: 0,
    lastSteer: 1,
    steerSensitivity: (opts.wheels && CONFIG.wheelSteer[opts.wheels]) || 1,
    events: [],
  };
}

export const finalScore = (st: GameState) => Math.floor(st.score);

/** Velocità obiettivo: bioma × combo × turbo × boost × rallentamento da urto. */
function targetSpeed(st: GameState) {
  const c = CONFIG.speed;
  let v = Math.min(c.max, c.base + c.perBiome * st.biome) * (1 + c.comboBonus * (st.combo - 1));
  if (st.powerups.turbo > 0) v *= CONFIG.turboSpeedFactor;
  if (st.boostTimer > 0) v *= CONFIG.boost.speedFactor;
  if (st.slowTimer > 0) v *= CONFIG.hitSlowdown.factor;
  return v;
}

function snapToCenter(st: GameState) {
  const k = st.kart;
  const p = sampleAt(st.track, k.s);
  k.x = p.x; k.y = p.y; k.angle = p.angle; k.moveAngle = p.angle; k.yawRate = 0;
  k.lateral = 0; k.elevation = p.elevation; k.fallDepth = 0;
  k.drifting = false;
  st.driftTime = 0;
  st.driftPoints = 0;
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
    k.x += Math.cos(k.moveAngle) * k.speed * dt;
    k.y += Math.sin(k.moveAngle) * k.speed * dt;
    const t = CONFIG.fallDuration - st.fallTimer;
    k.fallDepth = 0.5 * 9.8 * t * t * 3;
    st.fallTimer -= DT;
    if (st.fallTimer <= 0) { st.phase = "over"; st.events.push({ type: "gameover" }); }
    return st;
  }
  if (st.phase === "crashing") {
    // frenata lineare fino a fermarsi alla fine dello schianto
    k.speed = Math.max(0, k.speed - (k.speed * DT) / Math.max(DT, st.fallTimer));
    k.yawRate = 0;
    k.x += Math.cos(k.moveAngle) * k.speed * dt;
    k.y += Math.sin(k.moveAngle) * k.speed * dt;
    st.fallTimer -= DT;
    if (st.fallTimer <= 0) { st.phase = "over"; st.events.push({ type: "gameover" }); }
    return st;
  }

  extendTrack(st.track, k.s + CONFIG.lookAhead);
  const biome = Math.floor(k.s / CONFIG.biomeLength);
  if (biome !== st.biome) { st.biome = biome; st.events.push({ type: "biome", index: biome }); }

  const { ice, oil } = surface(st);

  // la velocità insegue l'obiettivo (sale piano, scende più in fretta): niente scatti
  const target = targetSpeed(st);
  k.speed = target > k.speed ? Math.min(target, k.speed + CONFIG.speed.accel * DT) : Math.max(target, k.speed - CONFIG.speed.decel * DT);
  const speed = k.speed;

  // la strada non decide nulla: si gira solo con la sterzata (o sull'olio), altrimenti si va dritti
  if (steer !== 0) st.lastSteer = steer;
  const drifting = steer !== 0 || oil;
  steerKart(k, drifting ? steer || st.lastSteer : 0, speed, { ice, oil }, dt, st.steerSensitivity);
  k.drifting = drifting;

  k.x += Math.cos(k.moveAngle) * speed * dt;
  k.y += Math.sin(k.moveAngle) * speed * dt;
  const oldS = k.s;
  const pr = project(st.track, k.x, k.y, k.index);
  k.index = pr.index; k.s = pr.s; k.lateral = pr.lateral; k.elevation = pr.elevation;

  const mult = multiplier(st);
  st.score += Math.max(0, k.s - oldS) * CONFIG.score.perMeter * mult;

  if (drifting) {
    st.driftTime += dt;
    // più derapata = più punti (da un quarto a una volta e mezza il valore base)
    const slip = Math.abs(slipAngle(k)) / CONFIG.score.slipRef;
    st.driftPoints += dt * CONFIG.score.driftPerSecond * Math.max(0.25, Math.min(1.5, slip));
  } else if (st.driftTime > 0) {
    if (st.driftTime >= CONFIG.score.minDrift) {
      const points = st.driftPoints * mult;
      st.score += points;
      st.comboPoints++;
      st.events.push({ type: "driftEnd", seconds: st.driftTime, points });
    }
    st.driftTime = 0;
    st.driftPoints = 0;
  }

  const cur = sampleAt(st.track, k.s);
  const halfWidth = cur.width / 2 + (st.powerups.wide > 0 ? CONFIG.road.wideBonus / 2 : 0);
  if (cur.curvature !== 0 && Math.sign(k.lateral) === Math.sign(cur.curvature) && Math.abs(k.lateral) > halfWidth - CONFIG.score.perfectLineEdge) {
    st.score += CONFIG.score.perfectLinePerSecond * dt * mult;
  }

  handleItems(st, dt);
  // si cade solo quando il kart è uscito del tutto (più fallGrace): col centro appena fuori si resta in strada
  if (st.phase === "running" && Math.abs(k.lateral) > halfWidth + CONFIG.kartHalfWidth + CONFIG.fallGrace) startFall(st);

  st.combo = Math.min(CONFIG.comboMax, 1 + Math.floor(st.comboPoints / CONFIG.comboStep));
  return st;
}

export function revive(st: GameState): boolean {
  if (st.phase !== "over" || st.revived) return false;
  snapToCenter(st);
  for (const it of st.track.items) if (it.s >= st.kart.s && it.s <= st.kart.s + 25 && it.kind !== "coin" && it.kind !== "powerup" && it.kind !== "boost") it.consumed = true;
  st.phase = "running";
  st.endReason = null;
  st.lives = CONFIG.lives;
  st.kart.speed = Math.min(CONFIG.speed.max, CONFIG.speed.base + CONFIG.speed.perBiome * st.biome);
  st.revived = true;
  st.invulnTimer = CONFIG.invulnAfterRevive;
  return true;
}

export function simulate(
  seed: number,
  inputs: [number, Steer][],
  opts: { upgrades?: UpgradeLevels; wheels?: string; revived?: boolean; maxTicks?: number } = {},
): GameState {
  const st = createGame(seed, opts.upgrades, { wheels: opts.wheels });
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
