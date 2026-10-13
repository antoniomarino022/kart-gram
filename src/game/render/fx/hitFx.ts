import * as THREE from "three";
import { newEmit, type ParticlePool } from "./particles";

/** Cubetti di detrito contemporanei al massimo (un solo InstancedMesh). */
export const DEBRIS_POOL = 36;
const DEBRIS_LIFE = Math.fround(0.6);
const GRAVITY = 18;

const WHITE = new THREE.Color("#ffffff");
const FLASH_END = new THREE.Color("#ffd27a");
const GOLD = new THREE.Color("#ffd23a");
const ORANGE = new THREE.Color("#ff3800");
const WARM = new THREE.Color("#ffc040");

/**
 * Urti: detriti a cubetti (colore del bioma, gravità, un rimbalzo), lampo bianco nel punto d'impatto e scintille.
 * Lo `smash` (turbo che sfonda) è più grande e luminoso.
 */
export class HitFx {
  private mesh: THREE.InstancedMesh;
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private material = new THREE.MeshLambertMaterial({ color: "#ffffff" });
  private pos = new Float32Array(DEBRIS_POOL * 3);
  private vel = new Float32Array(DEBRIS_POOL * 3);
  private rot = new Float32Array(DEBRIS_POOL * 3);
  private spin = new Float32Array(DEBRIS_POOL * 3);
  private size = new Float32Array(DEBRIS_POOL);
  private floor = new Float32Array(DEBRIS_POOL);
  private age = new Float32Array(DEBRIS_POOL).fill(DEBRIS_LIFE);
  private next = 0;
  private live = false;
  private e = newEmit();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private eul = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private scene: THREE.Scene, private sparks: ParticlePool) {
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, DEBRIS_POOL);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.m.makeScale(0, 0, 0);
    for (let i = 0; i < DEBRIS_POOL; i++) { this.mesh.setMatrixAt(i, this.m); this.mesh.setColorAt(i, WHITE); }
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** Detriti vivi (per i test). */
  get liveCount() {
    let n = 0;
    for (let i = 0; i < DEBRIS_POOL; i++) if (this.age[i] < DEBRIS_LIFE) n++;
    return n;
  }

  /**
   * Impatto in (x, y, z) con il kart che va in direzione (fx, fz) a `speed` m/s.
   * `tints`: colori del bioma per i detriti; `smash`: versione più forte.
   */
  burst(x: number, y: number, z: number, fx: number, fz: number, speed: number, tints: readonly string[], smash: boolean) {
    const n = smash ? 14 : 8;
    const r = Math.random;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % DEBRIS_POOL;
      const i3 = i * 3;
      this.age[i] = 0;
      this.pos[i3] = x + (r() - 0.5) * 0.6; this.pos[i3 + 1] = y + r() * 0.4; this.pos[i3 + 2] = z + (r() - 0.5) * 0.6;
      // il kart in corsa trascina i detriti in avanti, ma sparano anche in fuori e in alto
      const fwd = speed * (smash ? 0.7 : 0.45) + r() * 3;
      const side = (r() - 0.5) * (smash ? 12 : 8);
      this.vel[i3] = fx * fwd - fz * side;
      this.vel[i3 + 1] = 3 + r() * (smash ? 6 : 4);
      this.vel[i3 + 2] = fz * fwd + fx * side;
      for (let a = 0; a < 3; a++) { this.rot[i3 + a] = r() * 6.28; this.spin[i3 + a] = (r() - 0.5) * 18; }
      this.size[i] = (smash ? 0.22 : 0.16) + r() * 0.16;
      this.floor[i] = y - 0.45 + this.size[i] * 0.5;
      this.c.set(tints[k % tints.length]);
      if (k % 4 === 3) this.c.lerp(WHITE, 0.6);
      this.mesh.setColorAt(i, this.c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.live = true;
    this.mesh.visible = true;

    // lampo bianco: un grosso alone che si allarga in fretta
    const e = this.e;
    e.x = x; e.y = y + 0.3; e.z = z;
    e.vx = fx * speed * 0.8; e.vy = 0; e.vz = fz * speed * 0.8;
    e.life = smash ? 0.2 : 0.14;
    e.size0 = smash ? 2.2 : 1.5; e.size1 = smash ? 3.4 : 2.3;
    e.c0.copy(WHITE); e.c1.copy(FLASH_END); e.hot = 1;
    e.gravity = 0; e.drag = 0; e.floor = null;
    this.sparks.emit(e);

    // scintille d'urto
    const m = smash ? 24 : 12;
    e.c0.copy(smash ? GOLD : WARM); e.c1.copy(ORANGE);
    for (let k = 0; k < m; k++) {
      const a = r() * Math.PI * 2, sp = 4 + r() * (smash ? 9 : 6);
      e.x = x; e.y = y + 0.3; e.z = z;
      e.vx = fx * speed * 0.6 + Math.cos(a) * sp; e.vy = 2 + r() * 5; e.vz = fz * speed * 0.6 + Math.sin(a) * sp;
      e.life = 0.3 + r() * 0.25;
      e.size0 = 0.25 + r() * 0.3; e.size1 = 0.05; e.hot = 1;
      e.gravity = 14; e.drag = 1.5; e.floor = y - 0.4;
      this.sparks.emit(e);
    }
  }

  update(dt: number) {
    if (!this.live) return;
    let any = false;
    for (let i = 0; i < DEBRIS_POOL; i++) {
      if (this.age[i] >= DEBRIS_LIFE) continue;
      const a = (this.age[i] = Math.min(DEBRIS_LIFE, this.age[i] + dt));
      const t = a / DEBRIS_LIFE;
      const i3 = i * 3;
      if (t >= 1) {
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      any = true;
      this.vel[i3 + 1] -= GRAVITY * dt;
      for (let k = 0; k < 3; k++) { this.pos[i3 + k] += this.vel[i3 + k] * dt; this.rot[i3 + k] += this.spin[i3 + k] * dt; }
      if (this.pos[i3 + 1] < this.floor[i] && this.vel[i3 + 1] < 0) {
        this.pos[i3 + 1] = this.floor[i];
        this.vel[i3 + 1] *= -0.3; this.vel[i3] *= 0.5; this.vel[i3 + 2] *= 0.5;
        for (let k = 0; k < 3; k++) this.spin[i3 + k] *= 0.5;
      }
      // restano pieni e si rimpiccioliscono solo nell'ultimo terzo
      const sc = this.size[i] * Math.min(1, (1 - t) * 3);
      this.p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      this.q.setFromEuler(this.eul.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2]));
      this.m.compose(this.p, this.q, this.s.set(sc, sc, sc));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.live = any;
    this.mesh.visible = any;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
