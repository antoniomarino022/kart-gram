import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createGame } from "../core/sim";
import { boostGeometry } from "./boostPad";
import { ItemMeshes } from "./itemMeshes";

describe("ItemMeshes", () => {
  it("rimuove gli oggetti consumati e li riusa dalla free list", () => {
    const st = createGame(5);
    let gets = 0;
    const models = { get: () => { gets++; return new THREE.Group(); } };
    const scene = new THREE.Scene();
    const im = new ItemMeshes(scene, models);
    const base = st.track.items[0];
    st.track.items = [100, 103].map((s, i) => ({ ...base, id: i + 1, kind: "coin" as const, s, lateral: 0, radius: 0.5 }));
    expect(st.track.items.length).toBe(2);
    st.kart.s = st.track.items[0].s - 10;
    im.update(st, 1, 0);
    expect(scene.children.length).toBe(2);
    expect(gets).toBe(2);

    st.track.items[0].consumed = true;
    im.update(st, 1, 0);
    expect(scene.children.length).toBe(1);

    // nuova moneta: riusa l'oggetto liberato invece di clonare il modello
    st.track.items = [...st.track.items, { ...st.track.items[1], id: 9999, consumed: false }];
    im.update(st, 1, 0);
    expect(scene.children.length).toBe(2);
    expect(gets).toBe(2);
    im.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("la pedana boost guarda verso l'alto (non viene scartata dal back-face culling) e copre la metà giusta", () => {
    const st = createGame(5);
    const base = { id: 1, kind: "boost" as const, s: 10, radius: 1.75, length: 12, speed: 0, consumed: false, passed: false, minDist: Infinity };
    const g = boostGeometry(st.track, { ...base, lateral: 1.75 });
    const pos = g.getAttribute("position"), idx = g.getIndex()!;
    const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i));
    for (let t = 0; t < idx.count; t += 3) {
      const n = new THREE.Vector3().subVectors(v(t + 1), v(t)).cross(new THREE.Vector3().subVectors(v(t + 2), v(t)));
      expect(n.y).toBeGreaterThan(0);
    }
    // sul rettilineo iniziale (verso -z) la metà sinistra ha x <= 0
    for (let i = 0; i < pos.count; i++) expect(pos.getX(i)).toBeLessThanOrEqual(1e-6);
  });
});
