import { describe, expect, it } from "vitest";
import { CONFIG, STEP } from "./config";
import { createTrack, extendTrack, project, sampleAt, trackLength } from "./track";
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

  it("spawns no items in the safe start and keeps obstacles spaced", () => {
    const t = createTrack(11); extendTrack(t, 6000);
    expect(t.items.length).toBeGreaterThan(20);
    for (const it of t.items) expect(it.s).toBeGreaterThanOrEqual(CONFIG.spawn.safeStart);
    const obstacles = t.items.filter((i) => i.kind !== "coin" && i.kind !== "powerup" && i.kind !== "boost").sort((a, b) => a.s - b.s);
    for (let i = 1; i < obstacles.length; i++) expect(obstacles[i].s - obstacles[i - 1].s).toBeGreaterThanOrEqual(6);
  });

  it("spawns no boost pads when boostChance is 0", () => {
    const t = createTrack(15); extendTrack(t, 15000);
    const pads = t.items.filter((i) => i.kind === "boost");
    expect(pads.length).toBe(0);
  });

  it("hearts spawn, rarer than other power-ups and turbo is disabled", () => {
    const t = createTrack(16); extendTrack(t, 40000);
    const count = (k: string) => t.items.filter((i) => i.kind === "powerup" && i.powerup === k).length;
    expect(count("heart")).toBeGreaterThan(0);
    expect(count("turbo")).toBe(0);
    expect(count("heart")).toBeLessThan(count("magnet"));
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

  it("geometry is identical with and without items", () => {
    const a = createTrack(21), b = createTrack(21, { spawnItems: false });
    extendTrack(a, 5000); extendTrack(b, 5000);
    expect(a.samples).toEqual(b.samples);
  });

  it("rivals stay inside the road width", () => {
    const t = createTrack(14); extendTrack(t, 15000);
    for (const it of t.items.filter((i) => i.kind === "rival")) {
      const pos = itemPosition(t, it);
      const r = project(t, pos.x, pos.y, Math.floor(it.s) - 5);
      expect(Math.abs(r.lateral)).toBeLessThanOrEqual(sampleAt(t, it.s).width / 2 - it.radius + 1e-6);
    }
    const narrow = createTrack(1, { spawnItems: false }); extendTrack(narrow, 100);
    const s = narrow.samples[70];
    s.width = 4.5;
    const rival = { id: 1, kind: "rival" as const, s: 70, lateral: 3, radius: 0.7, length: 0, speed: 9, consumed: false, passed: false, minDist: Infinity };
    const p = itemPosition(narrow, rival);
    const r = project(narrow, p.x, p.y, 65);
    expect(r.lateral).toBeCloseTo(4.5 / 2 - 0.7, 1);
  });
});
