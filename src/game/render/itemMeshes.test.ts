import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createGame } from "../core/sim";
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
});
