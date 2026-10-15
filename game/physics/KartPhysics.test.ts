import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARCADE_TIGHT, SURFACES } from "../config/kartPhysicsConfig";
import type { SurfaceParams } from "../config/kartPhysicsConfig";
import { KartPhysics, PhysicsLoop } from "./KartPhysics";
import type { KartInput, KartState, KartStepHost } from "./KartPhysics";

const CONFIG = ARCADE_TIGHT;

function makeInput(partial: Partial<KartInput> = {}): KartInput {
  return { throttle: 1, brake: 0, steer: 0, drift: false, autoDrift: false, ...partial };
}

/** Scripted host: steer is 0 for the first second, then hard right. */
class ScriptedHost implements KartStepHost {
  steps = 0;
  private readonly input = makeInput();

  readInput(): KartInput {
    this.input.steer = this.steps * CONFIG.fixedDt >= 1 ? 1 : 0;
    return this.input;
  }

  getSurface(): SurfaceParams {
    return SURFACES.asphalt;
  }

  afterStep(): void {
    this.steps += 1;
  }
}

function simulate(hz: number, seconds: number): { state: KartState; steps: number } {
  const physics = new KartPhysics(CONFIG);
  const loop = new PhysicsLoop(physics);
  const state = physics.createState(0, 0, 0);
  const host = new ScriptedHost();
  const frames = Math.round(seconds * hz);
  for (let i = 0; i < frames; i += 1) {
    loop.advance(1 / hz, state, host);
  }
  return { state, steps: host.steps };
}

describe("KartPhysics", () => {
  it("has no Phaser dependency", () => {
    const source = readFileSync(new URL("./KartPhysics.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from\s+["']phaser["']/);
  });

  it("is frame-rate independent (30/60/120 Hz give the same trajectory)", () => {
    const reference = simulate(120, 3);
    for (const hz of [30, 60]) {
      const run = simulate(hz, 3);
      expect(Math.abs(run.steps - reference.steps)).toBeLessThanOrEqual(1);
      expect(Math.abs(run.state.x - reference.state.x)).toBeLessThan(10);
      expect(Math.abs(run.state.y - reference.state.y)).toBeLessThan(10);
      expect(Math.abs(run.state.rotation - reference.state.rotation)).toBeLessThan(0.06);
    }
  });

  it("clamps speed to the maximum, including over-speed and surface caps", () => {
    const physics = new KartPhysics(CONFIG);
    const state = physics.createState(0, 0, 0);
    let peak = 0;
    for (let i = 0; i < 120 * 15; i += 1) {
      physics.step(state, makeInput(), SURFACES.asphalt, CONFIG.fixedDt);
      peak = Math.max(peak, state.forwardSpeed);
    }
    expect(peak).toBeLessThanOrEqual(CONFIG.maxSpeed * 1.000001);
    expect(state.forwardSpeed).toBeGreaterThan(CONFIG.maxSpeed * 0.85);

    const fast = physics.createState(0, 0, 0);
    fast.vy = -2000;
    for (let i = 0; i < 120 * 3; i += 1) {
      physics.step(fast, makeInput(), SURFACES.asphalt, CONFIG.fixedDt);
    }
    expect(fast.forwardSpeed).toBeLessThanOrEqual(CONFIG.maxSpeed * 1.01);

    const grass = physics.createState(0, 0, 0);
    for (let i = 0; i < 120 * 15; i += 1) {
      physics.step(grass, makeInput(), SURFACES.grass, CONFIG.fixedDt);
    }
    expect(grass.forwardSpeed).toBeLessThanOrEqual(CONFIG.maxSpeed * SURFACES.grass.maxSpeedMultiplier);
  });

  it("does not steer at zero speed", () => {
    const physics = new KartPhysics(CONFIG);
    const state = physics.createState(0, 0, 0);
    for (let i = 0; i < 240; i += 1) {
      physics.step(state, makeInput({ throttle: 0, steer: 1 }), SURFACES.asphalt, CONFIG.fixedDt);
    }
    expect(state.rotation).toBe(0);
  });

  it("enters drift above the minimum speed and exits when released", () => {
    const physics = new KartPhysics(CONFIG);
    const state = physics.createState(0, 0, 0);
    state.vy = -500;
    let started = false;
    for (let i = 0; i < 10; i += 1) {
      physics.step(state, makeInput({ steer: 1, drift: true }), SURFACES.asphalt, CONFIG.fixedDt);
      started = started || physics.events.driftStart;
    }
    expect(started).toBe(true);
    expect(state.driftState).toBe("DRIFT_CHARGING");
    expect(state.driftDirection).toBe(1);

    physics.step(state, makeInput({ steer: 1, drift: false }), SURFACES.asphalt, CONFIG.fixedDt);
    expect(state.driftState).not.toBe("DRIFT_CHARGING");

    const slow = physics.createState(0, 0, 0);
    slow.vy = -CONFIG.driftMinSpeed * 0.5;
    physics.step(slow, makeInput({ steer: 1, drift: true }), SURFACES.asphalt, CONFIG.fixedDt);
    expect(slow.driftState).toBe("GRIP");
  });

  it("grants a boost proportional to the drift tier reached", () => {
    const expected: ReadonlyArray<readonly [number, number, number]> = [
      [0.1, 0, 1],
      [0.9, 1, CONFIG.boostSpeedMultiplierTier1],
      [1.6, 2, CONFIG.boostSpeedMultiplierTier2],
      [2.6, 3, CONFIG.boostSpeedMultiplierTier3],
    ];
    for (const [charge, tier, multiplier] of expected) {
      const physics = new KartPhysics(CONFIG);
      const state = physics.createState(0, 0, 0);
      state.vy = -500;
      physics.step(state, makeInput({ steer: 1, drift: true }), SURFACES.asphalt, CONFIG.fixedDt);
      expect(state.driftState).toBe("DRIFT_CHARGING");

      state.driftCharge = charge;
      physics.step(state, makeInput({ steer: 1, drift: true }), SURFACES.asphalt, CONFIG.fixedDt);
      physics.step(state, makeInput({ steer: 1, drift: false }), SURFACES.asphalt, CONFIG.fixedDt);

      expect(physics.events.boostStart).toBe(tier);
      expect(state.boostMultiplier).toBeCloseTo(multiplier, 5);
      expect(state.driftState).toBe(tier === 0 ? "GRIP" : "BOOST");
    }
  });

  it("reflects the normal component and keeps most tangential speed on wall hits", () => {
    const physics = new KartPhysics(CONFIG);
    const state = physics.createState(0, 0, 0);
    state.vx = -300;
    state.vy = -600;
    physics.resolveWallCollision(state, { nx: 1, ny: 0, penetration: 5 });

    expect(state.vx).toBeCloseTo(300 * CONFIG.collisionRestitution, 5);
    expect(state.vy).toBeCloseTo(-600 * CONFIG.collisionTangentKeep, 5);
    expect(state.x).toBeCloseTo(5, 5);
    expect(state.lastImpactStrength).toBeCloseTo(300, 5);
    expect(state.stunTime).toBeGreaterThan(0);
    expect(state.stunTime).toBeLessThanOrEqual(CONFIG.maxImpactStun);
  });
});
