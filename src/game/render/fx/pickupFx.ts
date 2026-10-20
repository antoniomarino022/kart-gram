import * as THREE from "three";
import { POWERUP_COLORS } from "../models";
import { newEmit, type ParticlePool } from "./particles";

const RINGS = 3;
const RING_LIFE = 0.4;
const RING_FROM = 0.5, RING_TO = 3;
const COIN_SPARKLES = 14;

const SHOCK_RINGS = 2;
const SHOCK_LIFE = 0.55;
const SHOCK_FROM = 1, SHOCK_TO = 16;
const SHOCK_COLOR = new THREE.Color("#00e5ff");
const SHOCK_CORE = new THREE.Color("#e0f7fa");

const GOLD = new THREE.Color("#ffd84a");
const GOLD_END = new THREE.Color("#ff9a1a");
const WHITE = new THREE.Color("#ffffff");
const BOOST = new THREE.Color("#7ff3ff");
const BOOST_END = new THREE.Color("#3a7bff");

/**
 * Raccolte: moneta = corona di brillantini dorati attorno al kart; power-up = anello colorato che si allarga
 * a terra (0.5→3 m in 0.4 s); boost = brillantini che sfrecciano in avanti lungo i fianchi.
 */
export class PickupFx {
  private geometry = new THREE.RingGeometry(0.82, 1, 48);
  private rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private age = new Float32Array(RINGS).fill(RING_LIFE);
  private next = 0;
  private e = newEmit();
  private shockRings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = [];
  private shockAge = new Float32Array(SHOCK_RINGS).fill(SHOCK_LIFE);
  private shockNext = 0;

  constructor(private scene: THREE.Scene, private sparks: ParticlePool) {
    this.geometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: "#ffffff", transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, fog: false,
      });
      const ring = new THREE.Mesh(this.geometry, mat);
      ring.visible = false;
      ring.renderOrder = 4;
      ring.frustumCulled = false;
      this.rings.push(ring);
      scene.add(ring);
    }
    for (let i = 0; i < SHOCK_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: "#00e5ff", transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, fog: false,
      });
      const ring = new THREE.Mesh(this.geometry, mat);
      ring.visible = false;
      ring.renderOrder = 5;
      ring.frustumCulled = false;
      this.shockRings.push(ring);
      scene.add(ring);
    }
  }

  coin(x: number, y: number, z: number, vx: number, vz: number) {
    const e = this.e, r = Math.random;
    e.c0.copy(GOLD); e.c1.copy(GOLD_END);
    for (let k = 0; k < COIN_SPARKLES; k++) {
      const a = (k / COIN_SPARKLES) * Math.PI * 2 + r() * 0.3, sp = 2.5 + r() * 1.5;
      e.x = x; e.y = y + 0.6; e.z = z;
      e.vx = vx + Math.cos(a) * sp; e.vy = 1.5 + r() * 2.5; e.vz = vz + Math.sin(a) * sp;
      e.life = 0.35 + r() * 0.15;
      e.size0 = 0.22 + r() * 0.15; e.size1 = 0.04; e.hot = 1;
      e.gravity = 5; e.drag = 2; e.floor = null;
      this.sparks.emit(e);
    }
  }

  shockwave(x: number, y: number, z: number) {
    const i = this.shockNext;
    this.shockNext = (this.shockNext + 1) % SHOCK_RINGS;
    this.shockAge[i] = 0;
    const ring = this.shockRings[i];
    ring.material.color.copy(SHOCK_COLOR);
    ring.position.set(x, y + 0.15, z);
    ring.scale.setScalar(SHOCK_FROM);
    ring.visible = true;

    const e = this.e, r = Math.random;
    e.c0.copy(SHOCK_CORE); e.c1.copy(SHOCK_COLOR);
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2 + r() * 0.2, sp = 12 + r() * 8;
      e.x = x; e.y = y + 0.3 + r() * 0.4; e.z = z;
      e.vx = Math.cos(a) * sp; e.vy = 0.5 + r() * 2.5; e.vz = Math.sin(a) * sp;
      e.life = 0.45 + r() * 0.15;
      e.size0 = 0.45 + r() * 0.25; e.size1 = 0.05; e.hot = 1;
      e.gravity = 2; e.drag = 1.4; e.floor = null;
      this.sparks.emit(e);
    }
  }

  powerup(kind: string, x: number, y: number, z: number, vx: number, vz: number) {
    const i = this.next;
    this.next = (this.next + 1) % RINGS;
    const color = POWERUP_COLORS[kind] ?? "#ffffff";
    this.age[i] = 0;
    const ring = this.rings[i];
    ring.material.color.set(color);
    ring.position.set(x, y + 0.12, z);
    ring.scale.setScalar(RING_FROM);
    ring.visible = true;
    // alone colorato al centro
    const e = this.e;
    e.c0.set(color).lerp(WHITE, 0.4); e.c1.set(color);
    e.x = x; e.y = y + 0.6; e.z = z; e.vx = vx; e.vy = 0; e.vz = vz;
    e.life = 0.25; e.size0 = 1.2; e.size1 = 2; e.hot = 0.5; e.gravity = 0; e.drag = 0; e.floor = null;
    this.sparks.emit(e);
  }

  /** `fx, fz`: direzione del kart; i brillantini partono dietro il kart e lo superano lungo i fianchi. */
  boost(x: number, y: number, z: number, fx: number, fz: number, speed: number) {
    const e = this.e, r = Math.random;
    e.c0.copy(BOOST); e.c1.copy(BOOST_END);
    for (let k = 0; k < 18; k++) {
      const side = (k % 2 ? 1 : -1) * (0.7 + r() * 0.6), back = 1 + r() * 2;
      e.x = x - fx * back - fz * side; e.y = y + 0.2 + r() * 0.6; e.z = z - fz * back + fx * side;
      const sp = speed + 10 + r() * 8;
      e.vx = fx * sp; e.vy = r() * 0.5; e.vz = fz * sp;
      e.life = 0.35 + r() * 0.15;
      e.size0 = 0.3 + r() * 0.2; e.size1 = 0.05; e.hot = 1;
      e.gravity = 0; e.drag = 1; e.floor = null;
      this.sparks.emit(e);
    }
  }

  /** Gli anelli seguono il kart (x, y, z). */
  update(dt: number, x: number, y: number, z: number) {
    for (let i = 0; i < SHOCK_RINGS; i++) {
      if (this.shockAge[i] >= SHOCK_LIFE) continue;
      const a = (this.shockAge[i] = Math.min(SHOCK_LIFE, this.shockAge[i] + dt));
      const t = a / SHOCK_LIFE;
      const ring = this.shockRings[i];
      if (t >= 1) { ring.visible = false; continue; }
      const ease = 1 - Math.pow(1 - t, 3);
      ring.scale.setScalar(SHOCK_FROM + (SHOCK_TO - SHOCK_FROM) * ease);
      ring.material.opacity = (1 - t) * 0.85;
    }

    for (let i = 0; i < RINGS; i++) {
      if (this.age[i] >= RING_LIFE) continue;
      const a = (this.age[i] = Math.min(RING_LIFE, this.age[i] + dt));
      const t = a / RING_LIFE;
      const ring = this.rings[i];
      if (t >= 1) { ring.visible = false; continue; }
      const ease = 1 - (1 - t) * (1 - t);
      ring.scale.setScalar(RING_FROM + (RING_TO - RING_FROM) * ease);
      ring.position.set(x, y + 0.12, z);
      ring.material.opacity = 1 - t;
    }
  }

  dispose() {
    for (const ring of this.rings) { this.scene.remove(ring); ring.material.dispose(); }
    for (const ring of this.shockRings) { this.scene.remove(ring); ring.material.dispose(); }
    this.geometry.dispose();
  }
}
