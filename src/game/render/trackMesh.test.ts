import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTrack, extendTrack } from "../core/track";
import { TrackMeshes } from "./trackMesh";

describe("TrackMeshes", () => {
  it("tiene i chunk da kartS-30 a kartS+250 e libera quelli superati", () => {
    const track = createTrack(7);
    extendTrack(track, 1000);
    const scene = new THREE.Scene();
    const tm = new TrackMeshes(scene);
    tm.update(track, 0);
    expect(tm.chunkKeys()).toEqual([0, 1, 2, 3, 4, 5]);
    tm.update(track, 400);
    expect(tm.chunkKeys()).toEqual([7, 8, 9, 10, 11, 12, 13]);
    // 2 mesh per chunk (strada + fasce strada larga)
    expect(scene.children.length).toBe(14);
    tm.dispose();
    expect(scene.children.length).toBe(0);
  });
});
