import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createGame } from "../../core/sim";
import { Sparks } from "../sparks";
import { Trail } from "../trail";
import { CameraKick, MAX_OFFSET, MAX_ROT } from "./cameraKick";
import { DEBRIS_POOL, HitFx } from "./hitFx";
import { Fx } from "./index";
import { newEmit, ParticlePool } from "./particles";
import { speedLineTarget } from "./speedLines";

describe("CameraKick", () => {
  it("resta nei limiti e torna a 0", () => {
    const k = new CameraKick();
    k.kick(1, { x: 1, y: 1, z: -1 });
    k.kick(1, { x: 1, y: 1, z: -1 });
    k.punchFov(9);
    let peak = 0, peakRot = 0;
    for (let i = 0; i < 120; i++) {
      k.update(1 / 60);
      peak = Math.max(peak, Math.abs(k.offset.x), Math.abs(k.offset.y), Math.abs(k.offset.z));
      peakRot = Math.max(peakRot, Math.abs(k.pitch), Math.abs(k.roll));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(MAX_OFFSET);
    expect(peakRot).toBeLessThanOrEqual(MAX_ROT + 1e-9);
    for (let i = 0; i < 120; i++) k.update(1 / 60);
    expect(k.offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(k.fov).toBe(0);
    expect(k.active).toBe(false);
  });

  it("è stabile anche con frame lunghi", () => {
    const k = new CameraKick();
    k.kick(1, { x: 0, y: 1, z: 0 });
    for (let i = 0; i < 20; i++) k.update(0.25);
    expect(Math.abs(k.offset.y)).toBeLessThan(1e-3);
  });

  it("con dt 0 (pausa) non cambia nulla", () => {
    const k = new CameraKick();
    k.kick(1, { x: 0, y: 1, z: 0 });
    k.update(0);
    expect(k.offset.y).toBe(0);
  });
});

describe("ParticlePool", () => {
  it("non supera mai la capacità e si svuota", () => {
    const p = new ParticlePool(16);
    const e = newEmit();
    e.life = 0.5;
    for (let i = 0; i < 100; i++) p.emit(e);
    expect(p.liveCount).toBeLessThanOrEqual(16);
    p.update(0.1, 400);
    expect(p.liveCount).toBe(16);
    expect(p.points.visible).toBe(true);
    p.update(1, 400);
    expect(p.liveCount).toBe(0);
    expect(p.points.visible).toBe(false);
  });

  it("rimbalza una volta sul suolo", () => {
    const p = new ParticlePool(1);
    const e = newEmit();
    Object.assign(e, { y: 1, vy: 0, gravity: 20, life: 5, floor: 0 });
    p.emit(e);
    let minY = Infinity, bounced = false, prevY = 1;
    const pos = p.points.geometry.getAttribute("position");
    for (let i = 0; i < 120; i++) {
      p.update(1 / 60, 400);
      const y = pos.getY(0);
      minY = Math.min(minY, y);
      if (y > prevY + 1e-6) bounced = true;
      prevY = y;
    }
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(bounced).toBe(true);
    expect(pos.getY(0)).toBe(0);
  });
});

describe("Sparks", () => {
  it("raffica a inizio drift, pool limitato, si spengono", () => {
    const scene = new THREE.Scene();
    const s = new Sparks(scene, "#ff00ff");
    const wheel = new THREE.Vector3(), back = new THREE.Vector3(0, 0, 1);
    s.update(true, wheel, 1, back, 1 / 60, 400);
    expect(s.liveCount).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < 600; i++) { wheel.z -= 0.4; s.update(true, wheel, 1, back, 1 / 60, 400); }
    expect(s.liveCount).toBeLessThanOrEqual(160);
    for (let i = 0; i < 60; i++) s.update(false, wheel, 1, back, 1 / 60, 400);
    expect(s.liveCount).toBe(0);
    s.dispose();
    expect(scene.children.length).toBe(0);
  });
});

describe("Trail", () => {
  it("la nuvola di fine drift resta nel pool", () => {
    const scene = new THREE.Scene();
    const t = new Trail(scene, "#ffffff", "trail_basic");
    const a = new THREE.Vector3(), b = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < 300; i++) { a.z -= 0.3; b.z -= 0.3; t.update(true, a, b, 1 / 60, i / 60, 400, new THREE.Color()); }
    for (let i = 0; i < 20; i++) t.burst();
    expect(t.liveCount).toBeLessThanOrEqual(128);
    for (let i = 0; i < 60; i++) t.update(false, a, b, 1 / 60, 5, 400, new THREE.Color());
    expect(t.liveCount).toBe(0);
    t.dispose();
  });
});

describe("HitFx", () => {
  it("detriti limitati al pool e spariscono dopo 0.6 s", () => {
    const scene = new THREE.Scene();
    const pool = new ParticlePool(64);
    const h = new HitFx(scene, pool);
    for (let i = 0; i < 10; i++) h.burst(0, 0, 0, 1, 0, 20, ["#ff0000", "#00ff00"], i % 2 === 0);
    expect(h.liveCount).toBe(DEBRIS_POOL);
    expect(pool.liveCount).toBeLessThanOrEqual(64);
    for (let i = 0; i < 40; i++) h.update(1 / 60);
    expect(h.liveCount).toBe(0);
    h.dispose();
    expect(scene.children.length).toBe(0);
  });
});

describe("speedLineTarget", () => {
  it("parte dal 70% della velocità massima; turbo/boost la tengono accesa", () => {
    expect(speedLineTarget(10, 26, false)).toBe(0);
    expect(speedLineTarget(0.7 * 26, 26, false)).toBe(0);
    expect(speedLineTarget(26, 26, false)).toBeGreaterThan(0.5);
    expect(speedLineTarget(60, 26, false)).toBe(1);
    expect(speedLineTarget(10, 26, true)).toBeGreaterThanOrEqual(0.7);
  });
});

describe("Fx", () => {
  it("gestisce tutti gli eventi, calcia la camera e libera la scena", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const fx = new Fx(scene);
    const st = createGame(3);
    const events = [
      { type: "coin" }, { type: "powerup", kind: "turbo" }, { type: "hit" }, { type: "smash" }, { type: "nearMiss" },
      { type: "driftEnd", seconds: 2, points: 40 }, { type: "fall" }, { type: "shieldUsed" }, { type: "boost" },
      { type: "biome", index: 1 }, { type: "gameover" }, { type: "unknown" },
    ] as const;
    for (const e of events) fx.onEvent(e as never, st);
    fx.restore(camera);
    fx.update(st, 1 / 60, 400, camera);
    expect(camera.position.length()).toBeGreaterThan(0);
    expect(camera.fov).toBeGreaterThan(60);
    fx.restore(camera);
    expect(camera.fov).toBeCloseTo(60);
    for (let i = 0; i < 240; i++) { fx.restore(camera); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); fx.update(st, 1 / 60, 400, camera); }
    expect(fx.kick.active).toBe(false);
    expect(camera.fov).toBeCloseTo(60);
    fx.dispose();
    expect(scene.children.length).toBe(0);
  });
});
