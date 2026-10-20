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
 * Kart del giocatore: root (posizione, yaw del muso, pendenza) → pivot (rollio e schiacciamento in curva) → modello + 4 ruote.
 * Le mesh con materiale "paint" ricevono un clone del materiale con la vernice del loadout.
 */
export class KartRig {
  readonly root = new THREE.Group();
  readonly pivot = new THREE.Group();
  private body: THREE.Object3D;
  private wheels: THREE.Object3D[] = [];
  /** Ruote anteriori (z negativa, il kart guarda -Z): sterzano visivamente. */
  private front: THREE.Object3D[] = [];
  private paints: Paint[] = [];
  private shield: THREE.Mesh;
  private ghostAura: THREE.Mesh;
  private blob: THREE.Mesh;
  private owned: { dispose(): void }[] = [];
  private glowing = false;
  private tail: THREE.Vector3[] = [];

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
        // prima il rotolamento (x), poi la sterzata (y)
        w.rotation.order = "YXZ";
        this.pivot.add(w);
        this.wheels.push(w);
        if (z < 0) this.front.push(w);
      }
    }
    this.applyPaint(loadout.paint, envMap);
    this.addRearDetails();

    const shieldGeo = new THREE.SphereGeometry(1.3, 18, 12);
    const shieldMat = new THREE.MeshBasicMaterial({ color: "#6fd3ff", transparent: true, opacity: 0.22, depthWrite: false });
    this.shield = new THREE.Mesh(shieldGeo, shieldMat);
    this.shield.position.y = 0.5;
    this.shield.visible = false;
    this.pivot.add(this.shield);

    const auraGeo = new THREE.SphereGeometry(1.38, 20, 14);
    const auraMat = new THREE.MeshBasicMaterial({
      color: "#9d4edd",
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ghostAura = new THREE.Mesh(auraGeo, auraMat);
    this.ghostAura.position.y = 0.45;
    this.ghostAura.visible = false;
    this.pivot.add(this.ghostAura);

    const blobGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
    this.owned.push(blobMat.map!);
    this.blob = new THREE.Mesh(blobGeo, blobMat);
    this.blob.position.y = 0.03;
    this.blob.scale.set(0.85, 1, 1.2);
    this.blob.renderOrder = 1;
    this.root.add(this.blob);
    this.owned.push(shieldGeo, shieldMat, auraGeo, auraMat, blobGeo, blobMat);
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

  /**
   * Fanali rossi emissivi e due scarichi grigi, attaccati al retro del modello (bounding box): vanno con qualunque kart.
   * I modelli guardano verso -Z, quindi il retro è a z massima.
   */
  private addRearDetails() {
    this.body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.body);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.8), new THREE.Vector3(0.5, 0.75, 0.8));
    const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
    const z = box.max.z;
    const lightY = box.min.y + h * 0.55, lightX = w * 0.32;

    const lightGeo = new THREE.BoxGeometry(Math.min(0.26, w * 0.24), Math.max(0.07, h * 0.12), 0.06);
    const lightMat = new THREE.MeshBasicMaterial({ color: "#ff2238" });
    const pipeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8).rotateX(Math.PI / 2);
    const pipeMat = new THREE.MeshLambertMaterial({ color: "#8d929c" });
    this.owned.push(lightGeo, lightMat, pipeGeo, pipeMat);
    for (const side of [-1, 1]) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(side * lightX, lightY, z + 0.01);
      const p = new THREE.Mesh(pipeGeo, pipeMat);
      p.position.set(side * Math.min(0.2, w * 0.18), box.min.y + h * 0.22, z + 0.06);
      this.pivot.add(l, p);
      this.tail.push(new THREE.Vector3(side * lightX, lightY, z + 0.04));
    }
  }

  /** Angolo visivo delle ruote anteriori (rad, positivo = sinistra). */
  steerWheels(angle: number) {
    for (const w of this.front) w.rotation.y = angle;
  }

  /** Posizione mondo del fanale posteriore (side -1 sinistro, +1 destro). */
  tailLight(side: -1 | 1, out: THREE.Vector3) {
    return this.pivot.localToWorld(out.copy(this.tail[side < 0 ? 0 : 1]));
  }

  /** Stato visivo per frame. */
  update(opts: { speed: number; dt: number; time: number; blink: boolean; turbo: boolean; ghost?: boolean; shield: boolean; falling: boolean; spin: boolean }) {
    if (opts.spin) for (const w of this.wheels) w.rotation.x -= (opts.speed * opts.dt) / WHEEL_R;
    this.pivot.visible = !opts.blink;
    this.shield.visible = opts.shield;
    if (opts.shield) this.shield.scale.setScalar(1 + Math.sin(opts.time * 4) * 0.04);
    this.blob.visible = !opts.falling;

    this.ghostAura.visible = !!opts.ghost;
    if (opts.ghost) {
      this.ghostAura.scale.set(
        1.0 + Math.sin(opts.time * 6) * 0.05,
        1.0 + Math.cos(opts.time * 7) * 0.06,
        1.0 + Math.sin(opts.time * 5 + 1) * 0.05,
      );
      (this.ghostAura.material as THREE.MeshBasicMaterial).opacity = 0.28 + 0.12 * Math.sin(opts.time * 10);
      for (const p of this.paints) {
        p.mat.transparent = true;
        p.mat.opacity = 0.40 + 0.18 * Math.sin(opts.time * 10);
        p.mat.emissive.set("#b388ff");
        p.mat.emissiveIntensity = 0.7;
      }
      this.glowing = true;
    } else if (opts.turbo) {
      const k = 0.45 + 0.3 * Math.sin(opts.time * 20);
      for (const p of this.paints) { p.mat.transparent = false; p.mat.opacity = 1; p.mat.emissive.copy(TURBO_GLOW); p.mat.emissiveIntensity = k; }
      this.glowing = true;
    } else if (this.glowing) {
      for (const p of this.paints) { p.mat.transparent = false; p.mat.opacity = 1; p.mat.emissive.copy(p.emissive); p.mat.emissiveIntensity = p.intensity; }
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

/** Ombra morbida: cerchio scuro con bordo sfumato. */
function blobTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.max(0, Math.min(1, (1 - r) / 0.55));
      data[(y * size + x) * 4 + 3] = Math.round(a * a * 0.42 * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
