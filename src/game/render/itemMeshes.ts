import * as THREE from "three";
import { CONFIG, DT } from "../core/config";
import { itemPosition, type Item } from "../core/items";
import type { GameState } from "../core/sim";
import { sampleAt, type Track } from "../core/track";
import type { ModelLibrary } from "./models";

/** Oltre questa distanza davanti al kart gli oggetti non vengono creati. */
const VIEW_AHEAD = 200;
const DECAL_LIFT = 0.02;
const HALF_PI = Math.PI / 2;

/** `pool`: chiave della free list in cui rimettere l'oggetto alla rimozione (assente per il ghiaccio, che ha geometria propria). */
interface Entry { obj: THREE.Object3D; seen: number; pool?: string; ownGeometry?: THREE.BufferGeometry }

const MODEL_OF: Partial<Record<Item["kind"], string>> = {
  cone: "obstacle_cone", barrier: "obstacle_barrier", rival: "rival_kart", coin: "coin",
};

function decalMaterial<T extends THREE.Material>(m: T): T {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
}

/** Oggetti sulla strada: modelli (coni, barriere, rival, monete, power-up) e decal piatti (olio, buchi, ghiaccio). */
export class ItemMeshes {
  private entries = new Map<number, Entry>();
  private frame = 0;
  private scratch = {} as Item;
  /** Oggetti rimossi, riusati per nome modello / tipo di decal: meno allocazioni e GC su Android. */
  private free = new Map<string, THREE.Object3D[]>();

  private circle = new THREE.CircleGeometry(1, 28).rotateX(-HALF_PI);
  private ring = new THREE.RingGeometry(1, 1.15, 28).rotateX(-HALF_PI);
  private oilMat = decalMaterial(new THREE.MeshStandardMaterial({ color: "#07070c", roughness: 0.1, metalness: 0.7 }));
  private holeMat = decalMaterial(new THREE.MeshBasicMaterial({ color: "#020205" }));
  private rimMat = decalMaterial(new THREE.MeshLambertMaterial({ color: "#3b3b4a" }));
  private iceMat = decalMaterial(new THREE.MeshStandardMaterial({
    color: "#c4ecff", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6, depthWrite: false,
  }));

  constructor(private scene: THREE.Scene, private models: ModelLibrary) {}

  /** Da chiamare a ogni frame: rilegge sempre `state.track.items` (l'array viene riassegnato dalla sim). */
  update(state: GameState, alpha: number, time: number) {
    const frame = ++this.frame;
    const track = state.track;
    const limit = state.kart.s + VIEW_AHEAD;
    const timeScale = state.powerups.slowmo > 0 ? CONFIG.slowmoTimeScale : 1;

    for (const it of track.items) {
      if (it.consumed || it.s > limit) continue;
      let e = this.entries.get(it.id);
      if (!e) {
        e = this.create(track, it);
        this.entries.set(it.id, e);
        this.scene.add(e.obj);
      }
      e.seen = frame;
      if (it.kind === "ice") continue;
      // i rival avanzano a ogni tick (solo entro 120 m dal kart): interpola tra il tick precedente e il corrente
      const lag = it.kind === "rival" && state.phase === "running" && it.s - state.kart.s < 120 ? it.speed * DT * timeScale * (1 - alpha) : 0;
      this.place(track, it, lag, e.obj, time);
    }

    for (const [id, e] of this.entries) {
      if (e.seen !== frame) this.remove(id, e);
    }
  }

  private create(track: Track, it: Item): Entry {
    if (it.kind === "ice") {
      const geo = iceGeometry(track, it);
      return { obj: new THREE.Mesh(geo, this.iceMat), seen: 0, ownGeometry: geo };
    }
    const pool = it.kind === "oil" || it.kind === "hole" ? it.kind : it.kind === "powerup" ? `powerup_${it.powerup}` : MODEL_OF[it.kind]!;
    const obj = this.free.get(pool)?.pop() ?? this.build(pool);
    if (it.kind === "oil" || it.kind === "hole") obj.scale.set(it.radius, 1, it.radius);
    return { obj, seen: 0, pool };
  }

  private build(pool: string): THREE.Object3D {
    let obj: THREE.Object3D;
    if (pool === "oil") obj = new THREE.Group().add(new THREE.Mesh(this.circle, this.oilMat));
    else if (pool === "hole") obj = new THREE.Group().add(new THREE.Mesh(this.circle, this.holeMat), new THREE.Mesh(this.ring, this.rimMat));
    else obj = this.models.get(pool);
    obj.rotation.order = "YXZ";
    return obj;
  }

  private place(track: Track, it: Item, lag: number, obj: THREE.Object3D, time: number) {
    let src = it;
    if (lag > 0) {
      src = Object.assign(this.scratch, it);
      src.s = it.s - lag;
    }
    const p = itemPosition(track, src);
    const yaw = p.angle - HALF_PI;
    let y = p.elevation;
    let pitch = 0;
    switch (it.kind) {
      case "coin":
        y += 0.6;
        obj.rotation.set(0, yaw + time * 3, 0);
        break;
      case "powerup":
        y += 0.8 + Math.sin(time * 3 + it.id) * 0.15;
        obj.rotation.set(0, time * 2, 0);
        break;
      default: {
        const a = sampleAt(track, src.s - 1).elevation, b = sampleAt(track, src.s + 1).elevation;
        pitch = Math.atan2(b - a, 2);
        if (it.kind === "oil" || it.kind === "hole") y += DECAL_LIFT;
        obj.rotation.set(pitch, yaw, 0);
      }
    }
    obj.position.set(p.x, y, -p.y);
  }

  private remove(id: number, e: Entry) {
    this.scene.remove(e.obj);
    e.ownGeometry?.dispose();
    if (e.pool) {
      let list = this.free.get(e.pool);
      if (!list) this.free.set(e.pool, (list = []));
      list.push(e.obj);
    }
    this.entries.delete(id);
  }

  dispose() {
    for (const [id, e] of this.entries) this.remove(id, e);
    this.free.clear();
    this.circle.dispose();
    this.ring.dispose();
    for (const m of [this.oilMat, this.holeMat, this.rimMat, this.iceMat]) m.dispose();
  }
}

/** Lastra di ghiaccio: tutta la larghezza della strada, da it.s a it.s + it.length. */
function iceGeometry(track: Track, it: Item) {
  const pos: number[] = [];
  const index: number[] = [];
  const n = Math.max(1, Math.ceil(it.length));
  for (let i = 0; i <= n; i++) {
    const p = sampleAt(track, it.s + (it.length * i) / n);
    const h = p.width / 2;
    const sx = -Math.sin(p.angle), sy = Math.cos(p.angle);
    const y = p.elevation + DECAL_LIFT;
    pos.push(p.x - sx * h, y, -(p.y - sy * h), p.x + sx * h, y, -(p.y + sy * h));
    if (i > 0) {
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
