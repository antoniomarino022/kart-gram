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
    expect(Math.max(...speeds)).toBeLessThanOrEqual(CONFIG.speed.max * (1 + CONFIG.speed.comboBonus * (CONFIG.comboMax - 1)));
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
      for (let i = 0; i < 8; i++) step(st, steer);
      expect(Math.sign(st.kart.angle - a0)).toBe(steer);
      expect(st.lastSteer).toBe(steer);
      // il muso gira prima della direzione di moto: il kart derapa
      expect(Math.sign(st.kart.angle - st.kart.moveAngle)).toBe(steer);
      // slalom (~0.53 s di drift in tutto) per restare in strada
      for (let i = 0; i < 16; i++) step(st, -steer as Steer);
      for (let i = 0; i < 8; i++) step(st, steer);
      expect(st.phase).toBe("running");
      step(st, 0);
      expect(st.events.some((e) => e.type === "driftEnd")).toBe(true);
      expect(st.comboPoints).toBe(1);
    });
  }

  it("steering is smooth: the yaw rate ramps up and eases out instead of jumping", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    const max = st.kart.speed / CONFIG.turnRadius;
    step(st, 1);
    expect(st.kart.yawRate).toBeGreaterThan(0);
    expect(st.kart.yawRate).toBeLessThan(max * 0.3);
    for (let i = 0; i < 15; i++) step(st, 1);
    expect(st.kart.yawRate).toBeGreaterThan(max * 0.9);
    step(st, 0);
    expect(st.kart.yawRate).toBeGreaterThan(max * 0.7);
  });

  it("released, the kart settles and then the heading stays constant (the road does not steer the kart)", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    for (let i = 0; i < 6; i++) step(st, 1);
    for (let i = 0; i < 6; i++) step(st, -1);
    for (let i = 0; i < 50; i++) step(st, 0);
    expect(st.phase).toBe("running");
    const a = st.kart.angle;
    for (let i = 0; i < 10; i++) step(st, 0);
    expect(st.kart.yawRate).toBe(0);
    expect(st.kart.angle).toBe(a);
    expect(st.kart.moveAngle).toBeCloseTo(a, 2);
  });

  it("on ice the kart keeps turning longer after release and slides more", () => {
    const run = (ice: boolean) => {
      const st = createGame(1, undefined, { spawnItems: false });
      if (ice) st.track.items.push(pad({ id: 990, kind: "ice", s: 0, lateral: 0, radius: 0, length: 40 }));
      for (let i = 0; i < 12; i++) step(st, -1);
      const a = st.kart.angle;
      for (let i = 0; i < 12; i++) step(st, 0);
      return { turned: a - st.kart.angle, slip: Math.abs(st.kart.angle - st.kart.moveAngle), yaw: st.kart.yawRate };
    };
    const dry = run(false), ice = run(true);
    expect(ice.turned).toBeGreaterThan(0); // continua a destra dopo il rilascio
    expect(Math.abs(ice.yaw)).toBeGreaterThan(Math.abs(dry.yaw));
    expect(ice.slip).toBeGreaterThan(dry.slip);
  });

  it("a boost pad speeds the kart up and emits boost once", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    const base = st.kart.speed;
    st.track.items.push(pad({ id: 991, kind: "boost", s: 5, lateral: 0, radius: 3.5, length: 12 }));
    let boosts = 0, top = 0;
    for (let i = 0; i < 90; i++) { step(st, 0); boosts += st.events.filter((e) => e.type === "boost").length; top = Math.max(top, st.kart.speed); }
    expect(boosts).toBe(1);
    expect(top).toBeGreaterThan(base * 1.2);
    expect(top).toBeLessThanOrEqual(base * CONFIG.boost.speedFactor + 1e-9);
    for (let i = 0; i < 60 * 3; i++) step(st, 0);
    expect(st.boostTimer).toBe(0);
    expect(st.kart.speed).toBe(base);
  });

  it("combo makes the kart faster, approaching the target smoothly", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    st.comboPoints = CONFIG.comboStep * 10;
    step(st, 0);
    expect(st.combo).toBe(CONFIG.comboMax);
    const target = CONFIG.speed.base * (1 + CONFIG.speed.comboBonus * (CONFIG.comboMax - 1));
    expect(st.kart.speed).toBeLessThan(CONFIG.speed.base + 1); // niente salto
    for (let i = 0; i < 60 * 3; i++) step(st, 0);
    expect(st.kart.speed).toBeCloseTo(target, 5);
  });

  it("the road is drivable at max combo speed: the bot survives 1500m", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const st = createGame(seed, undefined, { spawnItems: false });
      while (st.tick < 60 * 60 * 3 && st.phase !== "over" && st.kart.s < 1600) {
        st.comboPoints = CONFIG.comboStep * 10;
        step(st, botSteer(st));
      }
      expect(st.kart.s, `seed ${seed}`).toBeGreaterThan(1500);
    }
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

  it("shield absorbs one obstacle hit (no slowdown, combo kept) but never saves from a fall", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    st.powerups.shield = 1;
    st.comboPoints = 6;
    st.track.items.push(pad({ id: 996, kind: "cone", s: 10, lateral: 0, radius: 0.4, length: 0 }));
    let used = false;
    for (let i = 0; i < 60 && !used; i++) { step(st, 0); used = st.events.some((e) => e.type === "shieldUsed"); }
    expect(used).toBe(true);
    expect(st.powerups.shield).toBe(0);
    expect(st.comboPoints).toBe(6);
    expect(st.slowTimer).toBe(0);
    expect(st.lives).toBe(CONFIG.lives);

    const fall = createGame(1);
    fall.powerups.shield = 1;
    while (fall.phase === "running") step(fall, 0);
    expect(fall.phase).toBe("falling");
    expect(fall.powerups.shield).toBe(1);
  });

  it("each hit costs a life; at 0 lives the kart crashes, stops and the run is over", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    for (const [i, s] of [12, 40, 70].entries()) st.track.items.push(pad({ id: 980 + i, kind: "cone", s, lateral: 0, radius: 0.4, length: 0 }));
    const lives: number[] = [];
    let crashTick = -1;
    for (let i = 0; i < 60 * 10 && st.phase !== "over"; i++) {
      step(st, 0);
      for (const e of st.events) {
        if (e.type === "lifeLost") lives.push(e.lives);
        if (e.type === "crash") crashTick = st.tick;
      }
    }
    expect(lives).toEqual([2, 1, 0]);
    expect(crashTick).toBeGreaterThan(0);
    expect(st.phase).toBe("over");
    expect(st.endReason).toBe("crash");
    expect(st.kart.speed).toBe(0);
    expect(st.tick - crashTick).toBeCloseTo(CONFIG.crashDuration * 60, -1);
    expect(revive(st)).toBe(true);
    expect(st.lives).toBe(CONFIG.lives);
    expect(st.kart.speed).toBeGreaterThan(0);
  });

  it("a heart heals one life, up to the max", () => {
    const st = createGame(1, undefined, { spawnItems: false });
    st.lives = 1;
    st.track.items.push(pad({ id: 970, kind: "powerup", s: 8, lateral: 0, radius: 0.6, length: 0 }), pad({ id: 971, kind: "powerup", s: 20, lateral: 0, radius: 0.6, length: 0 }), pad({ id: 972, kind: "powerup", s: 32, lateral: 0, radius: 0.6, length: 0 }));
    for (const it of st.track.items) if (it.kind === "powerup") it.powerup = "heart";
    const gained: number[] = [];
    for (let i = 0; i < 120; i++) { step(st, 0); for (const e of st.events) if (e.type === "lifeGained") gained.push(e.lives); }
    expect(gained).toEqual([2, 3, 3]);
    expect(st.lives).toBe(CONFIG.lives);
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
