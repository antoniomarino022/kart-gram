import * as THREE from "three";
import { CONFIG, STEP } from "../core/config";
import type { Track, TrackSample } from "../core/track";
import { biomeAt } from "./palette";

/** Campioni per chunk: il chunk k copre i campioni [50k, 50k+50] (bordo condiviso, nessun buco). */
export const CHUNK = 50;
const BEHIND = 30;
const AHEAD = 250;
const SLAB = 0.6;
const EDGE = 0.25;
const CENTER_HALF = 0.075;
const LIFT = 0.01;
const WIDE = CONFIG.road.wideBonus / 2;

interface Chunk { road: THREE.Mesh; wide: THREE.Mesh }

/** Punto della strada in coordinate three: x = core.x, y = elevation, z = -core.y. */
function point(p: TrackSample, lateral: number, dy: number, out: number[]) {
  out.push(p.x - Math.sin(p.angle) * lateral, p.elevation + dy, -(p.y + Math.cos(p.angle) * lateral));
}

class Builder {
  pos: number[] = [];
  col: number[] = [];
  private tmp: number[] = [];
  /** Quad tra il campione a e b, da lateral l0 a l1, con offset verticali. */
  quad(a: TrackSample, b: TrackSample, l0: number, l1: number, dy0: number, dy1: number, c: THREE.Color, al0 = l0, al1 = l1) {
    const t = this.tmp;
    t.length = 0;
    point(a, l0, dy0, t); point(a, l1, dy1, t); point(b, al0, dy0, t); point(b, al1, dy1, t);
    // due triangoli: (0, 2, 1) e (1, 2, 3)
    for (const v of [0, 2, 1, 1, 2, 3]) {
      this.pos.push(t[v * 3], t[v * 3 + 1], t[v * 3 + 2]);
      this.col.push(c.r, c.g, c.b);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Nastro della strada a chunk: superficie, bordi, linea centrale tratteggiata e lastra sotto. */
export class TrackMeshes {
  private chunks = new Map<number, Chunk>();
  private material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  private wideMaterial = new THREE.MeshBasicMaterial({
    color: "#7dffa8", transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide,
  });

  constructor(private scene: THREE.Scene) {}

  /** `wide`: power-up "Strada larga" attivo, mostra le fasce aggiuntive ai lati. */
  update(track: Track, kartS: number, wide = false) {
    const last = track.samples.length - 1;
    const idx = kartS / STEP;
    const kMin = Math.max(0, Math.ceil((idx - BEHIND - CHUNK) / CHUNK));
    const kMax = Math.floor((idx + AHEAD) / CHUNK);

    for (const [k, ch] of this.chunks) {
      if (k < kMin || k > kMax) this.remove(k, ch);
    }
    for (let k = kMin; k <= kMax; k++) {
      if (this.chunks.has(k) || CHUNK * k + CHUNK > last) continue;
      const ch = this.build(track, k);
      this.chunks.set(k, ch);
      this.scene.add(ch.road, ch.wide);
    }
    for (const ch of this.chunks.values()) ch.wide.visible = wide;
  }

  /** Chunk presenti (per i test). */
  chunkKeys() {
    return [...this.chunks.keys()].sort((a, b) => a - b);
  }

  private build(track: Track, k: number): Chunk {
    const S = track.samples;
    const i0 = CHUNK * k, i1 = i0 + CHUNK;
    const pal = biomeAt(Math.floor(S[i0].s / CONFIG.biomeLength));
    const road = new THREE.Color(pal.road);
    const edge = new THREE.Color(pal.roadEdge);
    const stripe = new THREE.Color(pal.stripe);
    const under = road.clone().multiplyScalar(0.55);
    const side = road.clone().multiplyScalar(0.75);
    const white = new THREE.Color("#ffffff");

    const top = new Builder();
    const ext = new Builder();
    for (let i = i0; i < i1; i++) {
      const a = S[i], b = S[i + 1];
      const ha = a.width / 2, hb = b.width / 2;
      const dash = Math.floor(a.s / 2) % 2 === 0;
      // superficie: bordo sx | strada | linea centrale | strada | bordo dx
      top.quad(a, b, -ha, -ha + EDGE, LIFT, LIFT, edge, -hb, -hb + EDGE);
      top.quad(a, b, -ha + EDGE, -CENTER_HALF, 0, 0, road, -hb + EDGE, -CENTER_HALF);
      top.quad(a, b, -CENTER_HALF, CENTER_HALF, dash ? LIFT : 0, dash ? LIFT : 0, dash ? stripe : road);
      top.quad(a, b, CENTER_HALF, ha - EDGE, 0, 0, road, CENTER_HALF, hb - EDGE);
      top.quad(a, b, ha - EDGE, ha, LIFT, LIFT, edge, hb - EDGE, hb);
      // lastra: fianchi e fondo
      top.quad(a, b, -ha, -ha, 0, -SLAB, side, -hb, -hb);
      top.quad(a, b, ha, ha, 0, -SLAB, side, hb, hb);
      top.quad(a, b, -ha, ha, -SLAB, -SLAB, under, -hb, hb);
      // fasce della strada larga
      ext.quad(a, b, -ha - WIDE, -ha, LIFT / 2, LIFT / 2, white, -hb - WIDE, -hb);
      ext.quad(a, b, ha, ha + WIDE, LIFT / 2, LIFT / 2, white, hb, hb + WIDE);
    }
    if (k === 0) {
      // tappo all'inizio della strada: quad verticale sul primo campione
      const a = S[0], h = a.width / 2;
      const t: number[] = [];
      point(a, -h, 0, t); point(a, h, 0, t); point(a, -h, -SLAB, t); point(a, h, -SLAB, t);
      for (const v of [0, 2, 1, 1, 2, 3]) { top.pos.push(t[v * 3], t[v * 3 + 1], t[v * 3 + 2]); top.col.push(side.r, side.g, side.b); }
    }
    const roadMesh = new THREE.Mesh(top.geometry(), this.material);
    const wideMesh = new THREE.Mesh(ext.geometry(), this.wideMaterial);
    wideMesh.visible = false;
    wideMesh.renderOrder = 1;
    return { road: roadMesh, wide: wideMesh };
  }

  private remove(k: number, ch: Chunk) {
    this.scene.remove(ch.road, ch.wide);
    ch.road.geometry.dispose();
    ch.wide.geometry.dispose();
    this.chunks.delete(k);
  }

  dispose() {
    for (const [k, ch] of this.chunks) this.remove(k, ch);
    this.material.dispose();
    this.wideMaterial.dispose();
  }
}
