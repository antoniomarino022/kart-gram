import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { mulberry32 } from "../core/rng";
import { createTrack, extendTrack } from "../core/track";
import { BUILDING, clearOfRoad, newCluster, placeBuilding, rectDistance } from "./buildingPlacement";
import { Buildings } from "./buildings";
import { leadInSamples } from "./leadIn";

describe("rectDistance", () => {
  it("0 dentro, distanza euclidea fuori", () => {
    const r = { x: 10, y: 0, halfW: 2, halfD: 1 };
    expect(rectDistance(r, 10, 0)).toBe(0);
    expect(rectDistance(r, 15, 0)).toBe(3);
    expect(rectDistance(r, 15, 5)).toBeCloseTo(5);
  });
});

describe("placeBuilding", () => {
  it("rispetta anche il tratto visivo prima di s = 0", () => {
    const track = createTrack(4);
    extendTrack(track, 600);
    const rand = mulberry32(8);
    const lead = leadInSamples(track);
    let placed = 0;
    for (let n = 0; n < 300; n++) {
      const p = placeBuilding(track, newCluster(rand() * 40, rand), rand);
      if (!p) continue;
      placed++;
      for (const q of lead) expect(rectDistance(p, q.x, q.y)).toBeGreaterThanOrEqual(BUILDING.clearance + q.width / 2 - 1e-9);
    }
    expect(placed).toBeGreaterThan(50);
    // un blocco proprio sul tratto visivo viene rifiutato
    const q = lead[10];
    expect(clearOfRoad(track, { x: q.x, y: q.y, halfW: 2, halfD: 2 }, -320, 320)).toBe(false);
  });

  it("non invade mai la strada: almeno 6 m dal bordo di ogni campione", () => {
    const track = createTrack(11);
    extendTrack(track, 3000);
    const rand = mulberry32(3);
    let placed = 0;
    for (let s = 0; s < 2600; s += 7) {
      const p = placeBuilding(track, newCluster(s, rand), rand);
      if (!p) continue;
      placed++;
      for (const q of track.samples) expect(rectDistance(p, q.x, q.y)).toBeGreaterThanOrEqual(BUILDING.clearance + q.width / 2 - 1e-9);
      expect(p.halfW * 2).toBeGreaterThanOrEqual(BUILDING.minWidth);
      expect(p.halfW * 2).toBeLessThanOrEqual(BUILDING.maxWidth);
    }
    expect(placed).toBeGreaterThan(250);
  }, 15000);

  it("clearOfRoad rifiuta un edificio sulla strada", () => {
    const track = createTrack(1);
    const q = track.samples[30];
    expect(clearOfRoad(track, { x: q.x, y: q.y, halfW: 2, halfD: 2 }, 0, 60)).toBe(false);
    expect(clearOfRoad(track, { x: q.x + 500, y: q.y, halfW: 2, halfD: 2 }, 0, 60)).toBe(true);
  });
});

describe("Buildings", () => {
  it("una sola InstancedMesh, edifici lontani dalla strada anche dopo che si allunga", () => {
    const track = createTrack(42);
    extendTrack(track, 400);
    const scene = new THREE.Scene();
    const b = new Buildings(scene);
    b.update(track, 0);
    expect(scene.children.length).toBe(1);
    for (let s = 0; s <= 2000; s += 20) {
      extendTrack(track, s + 400);
      b.update(track, s);
    }
    for (const p of b.placements()) {
      for (const q of track.samples) expect(rectDistance(p, q.x, q.y)).toBeGreaterThanOrEqual(BUILDING.clearance + q.width / 2 - 1e-9);
    }
    b.dispose();
    expect(scene.children.length).toBe(0);
  });
});
