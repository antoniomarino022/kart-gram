import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { createGame, finalScore, revive, simulate, step, type GameState, type Steer } from "./sim";
import { sampleAt } from "./track";
import type { Item } from "./items";

/** Bot semplice: sterza (a sinistra o a destra) verso un punto 6m avanti sulla linea centrale. */
function botSteer(st: GameState): Steer {
  const k = st.kart;
  const target = sampleAt(st.track, k.s + 6);
  const aim = Math.atan2(target.y - k.y, target.x - k.x);
  const err = Math.atan2(Math.sin(aim - k.angle), Math.cos(aim - k.angle));
  return Math.abs(err) > 0.01 ? (Math.sign(err) as Steer) : 0;
}

function runBot(seed: number, ticks: number, opts?: { spawnItems?: boolean }) {
  const st = createGame(seed, undefined, opts);
  const inputs: [number, Steer][] = [];
  let last: Steer = 0;
  while (st.tick < ticks && st.phase !== "over") {
    const p = botSteer(st);
    if (p !== last) { inputs.push([st.tick, p]); last = p; }
    step(st, p);
  }
  return { st, inputs };
}

const pad = (p: Pick<Item, "id" | "kind" | "s" | "lateral" | "radius" | "length">): Item =>
  ({ speed: 0, consumed: false, passed: false, minDist: Infinity, ...p });

describe("sim", () => {
  it("with no input the kart drives the start straight then falls at the first curve", () => {
    const st = createGame(1);
    let fell = false;
    for (let i = 0; i < 60 * 30 && st.phase !== "over"; i++) { step(st, 0); if (st.events.some((e) => e.type === "fall")) fell = true; }
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
      step(st, botSteer(st));
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

  for (const steer of [1, -1] as const) {
    it(`drift ${steer > 0 ? "left" : "right"} turns that way and gives a driftEnd event and combo points`, () => {
      const st = createGame(1, undefined, { spawnItems: false });
      const a0 = st.kart.angle;
      for (let i = 0; i < 32; i++) step(st, steer); // ~0.53s di drift (più a lungo uscirebbe di strada)
      expect(Math.sign(st.kart.angle - a0)).toBe(steer);
      expect(Math.sign(st.kart.lateral)).toBe(steer);
      expect(st.lastSteer).toBe(steer);
      step(st, 0);
      expect(st.events.some((e) => e.type === "driftEnd")).toBe(true);
      expect(st.comboPoints).toBe(1);
    });
  }

  it("released, the heading stays constant (the road does not steer the kart)", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    for (let i = 0; i < 10; i++) step(st, 1);
    const a = st.kart.angle;
    for (let i = 0; i < 20; i++) step(st, 0);
    expect(st.kart.angle).toBe(a);
  });

  it("on ice the kart keeps sliding briefly after release, then goes straight", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    st.track.items.push(pad({ id: 990, kind: "ice", s: 0, lateral: 0, radius: 0, length: 40 }));
    for (let i = 0; i < 5; i++) step(st, -1);
    const a = st.kart.angle;
    step(st, 0);
    expect(st.kart.angle).toBeLessThan(a); // continua a destra
    for (let i = 0; i < 30; i++) step(st, 0);
    const b = st.kart.angle;
    step(st, 0);
    expect(st.kart.angle).toBe(b);
  });

  it("a boost pad speeds the kart up and emits boost once", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    const base = st.kart.speed;
    st.track.items.push(pad({ id: 991, kind: "boost", s: 5, lateral: 0, radius: 3.5, length: 12 }));
    let boosts = 0;
    for (let i = 0; i < 60; i++) { step(st, 0); boosts += st.events.filter((e) => e.type === "boost").length; }
    expect(boosts).toBe(1);
    expect(st.kart.speed).toBeCloseTo(base * CONFIG.boost.speedFactor, 5);
    for (let i = 0; i < 60 * 2; i++) step(st, 0);
    expect(st.boostTimer).toBe(0);
    expect(st.kart.speed).toBe(base);
  });

  it("a half-road boost pad only works on its side", () => {
    const center = createGame(1, undefined, { spawnItems: false });
    center.track.items.push(pad({ id: 992, kind: "boost", s: 5, lateral: 1.75, radius: 1.75, length: 12 }));
    for (let i = 0; i < 60; i++) step(center, 0); // al centro: niente boost
    expect(center.boostTimer).toBe(0);

    const st = createGame(1, undefined, { spawnItems: false });
    st.track.items.push(pad({ id: 993, kind: "boost", s: 12, lateral: 1.75, radius: 1.75, length: 12 }));
    for (let i = 0; i < 12; i++) step(st, 1); // un po' a sinistra
    for (let i = 0; i < 12; i++) step(st, -1); // di nuovo dritto, spostato a sinistra
    expect(st.kart.lateral).toBeGreaterThan(CONFIG.boost.minInside);
    let boosted = false;
    for (let i = 0; i < 60; i++) { step(st, 0); boosted ||= st.events.some((e) => e.type === "boost"); }
    expect(boosted).toBe(true);
  });

  it("hitting a cone slows down and resets combo; turbo smashes instead", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    st.comboPoints = 6;
    st.track.items.push({ id: 999, kind: "cone", s: 10, lateral: 0, radius: 0.4, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity });
    let hit = false;
    for (let i = 0; i < 60 && !hit; i++) { step(st, 0); hit = st.events.some((e) => e.type === "hit"); }
    expect(hit).toBe(true);
    expect(st.comboPoints).toBe(0);
    expect(st.slowTimer).toBeGreaterThan(0);

    const st2 = createGame(1, undefined, { spawnItems: false });
    st2.powerups.turbo = 5;
    st2.track.items.push({ id: 998, kind: "cone", s: 10, lateral: 0, radius: 0.4, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity });
    let smash = false;
    for (let i = 0; i < 60 && !smash; i++) { step(st2, 0); smash = st2.events.some((e) => e.type === "smash"); }
    expect(smash).toBe(true);
  });

  it("powerup pickup activates with upgraded duration", () => {
    const st = createGame(1, { turbo: 0, magnet: 2, slowmo: 0, x2: 0 }, { spawnItems: false });
    st.track.items.push({ id: 997, kind: "powerup", powerup: "magnet", s: 8, lateral: 0, radius: 0.6, length: 0, speed: 0, consumed: false, passed: false, minDist: Infinity });
    for (let i = 0; i < 60 && st.powerups.magnet === 0; i++) step(st, 0);
    expect(st.powerups.magnet).toBeGreaterThan(CONFIG.powerupBase.magnet + 1.5);
  });

  it("shield saves from one fall", () => {
    const st = createGame(1);
    st.powerups.shield = 1;
    let used = false;
    for (let i = 0; i < 60 * 30 && st.phase === "running" && !used; i++) { step(st, 0); used = st.events.some((e) => e.type === "shieldUsed"); }
    expect(used).toBe(true);
    expect(st.phase).toBe("running");
    expect(Math.abs(st.kart.lateral)).toBeLessThan(0.01);
  });

  it("revive works once and replay with revived matches", () => {
    const seed = 9;
    const st = createGame(seed);
    const inputs: [number, Steer][] = [];
    while (st.phase !== "over") step(st, 0);
    expect(revive(st)).toBe(true);
    expect(st.phase).toBe("running");
    let last: Steer = 0;
    while (st.phase !== "over" && st.tick < 60 * 120) {
      const p = botSteer(st);
      if (p !== last) { inputs.push([st.tick, p]); last = p; }
      step(st, p);
    }
    expect(revive(st)).toBe(false);
    const replay = simulate(seed, inputs, { revived: true, maxTicks: st.tick });
    expect(finalScore(replay)).toBe(finalScore(st));
  });
});
