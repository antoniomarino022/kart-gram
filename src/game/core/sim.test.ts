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
