import * as THREE from "three";
import type { ModelLibrary } from "./models";

export interface Loadout {
  kartModel: string;
  wheelModel: string;
  paint: { color: string; finish: "flat" | "metal" | "neon" };
  trailColor: string;
  trailId: string;
}

const WHEEL_X = 0.55, WHEEL_Y = 0.22, WHEEL_Z = 0.6, WHEEL_R = 0.22;
const TURBO_GLOW = new THREE.Color("#ff8a00");

interface Paint { mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number }

const asArray = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? m : [m]);

/**
 * Kart del giocatore: root (posizione, yaw, pendenza) → pivot (yaw del drift, rollio) → modello + 4 ruote.
 * Le mesh con materiale "paint" ricevono un clone del materiale con la vernice del loadout.
 */
export class KartRig {
  readonly root = new THREE.Group();
  readonly pivot = new THREE.Group();
  private body: THREE.Object3D;
  private wheels: THREE.Object3D[] = [];
  private paints: Paint[] = [];
  private shield: THREE.Mesh;
  private blob: THREE.Mesh;
  private owned: { dispose(): void }[] = [];
  private glowing = false;

  constructor(models: ModelLibrary, loadout: Loadout, envMap: THREE.Texture | null) {
    this.root.rotation.order = "YXZ";
    this.pivot.rotation.order = "YXZ";
    this.root.add(this.pivot);

    this.body = models.get(loadout.kartModel);
    this.pivot.add(this.body);
    for (const x of [-WHEEL_X, WHEEL_X]) {
      for (const z of [-WHEEL_Z, WHEEL_Z]) {
        const w = models.get(loadout.wheelModel);
        w.position.set(x, WHEEL_Y, z);
        this.pivot.add(w);
        this.wheels.push(w);
      }
    }
    this.applyPaint(loadout.paint, envMap);

    const shieldGeo = new THREE.SphereGeometry(1.3, 18, 12);
    const shieldMat = new THREE.MeshBasicMaterial({ color: "#6fd3ff", transparent: true, opacity: 0.22, depthWrite: false });
    this.shield = new THREE.Mesh(shieldGeo, shieldMat);
    this.shield.position.y = 0.5;
    this.shield.visible = false;
    this.pivot.add(this.shield);

    const blobGeo = new THREE.CircleGeometry(0.95, 20).rotateX(-Math.PI / 2);
    const blobMat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.28, depthWrite: false });
    this.blob = new THREE.Mesh(blobGeo, blobMat);
    this.blob.position.y = 0.03;
    this.blob.scale.set(0.75, 1, 1);
    this.root.add(this.blob);
    this.owned.push(shieldGeo, shieldMat, blobGeo, blobMat);
  }

  private applyPaint(paint: Loadout["paint"], envMap: THREE.Texture | null) {
    const clones = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    this.body.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = asArray(mesh.material).map((m) => {
        if (m.name !== "paint" || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m;
        let c = clones.get(m);
        if (!c) { c = (m as THREE.MeshStandardMaterial).clone(); clones.set(m, c); }
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
    });

    // più materiali "paint" (es. corpo + dettagli): il più chiaro prende la vernice, gli altri una tinta più scura in proporzione
    const list = [...clones.values()];
    const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const maxL = Math.max(1e-4, ...list.map((m) => lum(m.color)));
    const base = new THREE.Color(paint.color);
    for (const m of list) {
      m.color.copy(base).multiplyScalar(Math.max(0.35, lum(m.color) / maxL));
      if (paint.finish === "metal") {
        m.metalness = 0.8;
        m.roughness = 0.3;
        if (envMap) { m.envMap = envMap; m.envMapIntensity = 0.7; }
      } else if (paint.finish === "neon") {
        m.emissive.copy(m.color);
        m.emissiveIntensity = 0.8;
      }
      this.paints.push({ mat: m, emissive: m.emissive.clone(), intensity: m.emissiveIntensity });
      this.owned.push(m);
    }
  }

  /** Stato visivo per frame. */
  update(opts: { speed: number; dt: number; time: number; blink: boolean; turbo: boolean; shield: boolean; falling: boolean; spin: boolean }) {
    if (opts.spin) for (const w of this.wheels) w.rotation.x -= (opts.speed * opts.dt) / WHEEL_R;
    this.pivot.visible = !opts.blink;
    this.shield.visible = opts.shield;
    if (opts.shield) this.shield.scale.setScalar(1 + Math.sin(opts.time * 4) * 0.04);
    this.blob.visible = !opts.falling;

    if (opts.turbo) {
      const k = 0.45 + 0.3 * Math.sin(opts.time * 20);
      for (const p of this.paints) { p.mat.emissive.copy(TURBO_GLOW); p.mat.emissiveIntensity = k; }
      this.glowing = true;
    } else if (this.glowing) {
      for (const p of this.paints) { p.mat.emissive.copy(p.emissive); p.mat.emissiveIntensity = p.intensity; }
      this.glowing = false;
    }
  }

  /** Posizione mondo di un punto dietro una ruota posteriore (side -1 sinistra, +1 destra). */
  rearWheel(side: -1 | 1, out: THREE.Vector3) {
    return this.pivot.localToWorld(out.set(side * WHEEL_X, 0.08, WHEEL_Z + 0.2));
  }

  dispose() {
    this.root.removeFromParent();
    for (const o of this.owned) o.dispose();
  }
}
