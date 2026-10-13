import * as THREE from "three";
import { newEmit, ParticlePool } from "./fx/particles";

const POOL = 160;
/** Scintille al secondo a regime (velocità alta, drift lungo). */
const RATE = 90;
/** A inizio drift si emette di meno: il ritmo sale col tempo di slittamento. */
const SLIP_RAMP = 0.6;
/** Scintille della raffica d'inizio drift. */
export const DRIFT_BURST = 26;
const GRAVITY = 14;
/** Quota del suolo rispetto al punto d'emissione (dietro la ruota, poco sopra la strada). */
const FLOOR_DROP = 0.07;
/** Quanto della velocità del kart ereditano (il resto le fa restare indietro). */
const INHERIT = 0.55;
/** Oltre questo salto tra due frame (revive, teletrasporto) non si stima la velocità. */
const JUMP = 3;

const HOT = new THREE.Color("#ffb52a");
const ORANGE = new THREE.Color("#ff3800");

/** Scintille del drift: grosse gocce di luce additive che schizzano dalla ruota posteriore esterna e rimbalzano sulla strada. */
export class Sparks {
  private pool = new ParticlePool(POOL, 3);
  private e = newEmit();
  private start = new THREE.Color();
  private end = new THREE.Color();
  private last = new THREE.Vector3();
  private kv = new THREE.Vector3();
  private hasLast = false;
  private wasEmitting = false;
  private slip = 0;
  private acc = 0;

  constructor(private scene: THREE.Scene, tint = "#ffd84a") {
    const t = new THREE.Color(tint);
    // nucleo quasi bianco, coda arancio con una punta del colore della scia
    this.start.copy(HOT).lerp(t, 0.1);
    this.end.copy(ORANGE).lerp(t, 0.25);
    this.e.c0.copy(this.start);
    this.e.c1.copy(this.end);
    scene.add(this.pool.points);
  }

  /** Particelle vive (per i test). */
  get liveCount() { return this.pool.liveCount; }

  /**
   * `wheel`: ruota posteriore esterna, `side`: suo lato (-1 sinistra, 1 destra) per la spinta verso l'esterno.
   * `back`: direzione mondo verso il retro del kart (normalizzata). `scale`: pixel per metro a distanza 1.
   */
  update(emitting: boolean, wheel: THREE.Vector3, side: -1 | 1, back: THREE.Vector3, dt: number, scale: number) {
    // velocità del kart stimata dallo spostamento della ruota (niente dipendenze dal core)
    if (this.hasLast && dt > 0 && this.last.distanceToSquared(wheel) < JUMP * JUMP) {
      this.kv.subVectors(wheel, this.last).divideScalar(dt);
    } else if (dt > 0) this.kv.set(0, 0, 0);
    this.last.copy(wheel);
    this.hasLast = true;
    const speed = this.kv.length();

    if (emitting) {
      if (!this.wasEmitting) { this.slip = 0; this.burst(DRIFT_BURST, wheel, side, back); }
      this.slip = Math.min(1, this.slip + dt / SLIP_RAMP);
      const rate = RATE * (0.35 + 0.65 * this.slip) * Math.min(1.3, 0.5 + speed / 40);
      this.acc += dt * rate;
      while (this.acc >= 1) { this.acc -= 1; this.emit(wheel, back, side, 1); }
    } else this.acc = 0;
    this.wasEmitting = emitting;
    this.pool.update(dt, scale);
  }

  /** Raffica di `n` scintille più veloci e grandi (inizio drift, near miss). */
  burst(n: number, wheel: THREE.Vector3, side: number, back: THREE.Vector3) {
    for (let i = 0; i < n; i++) this.emit(wheel, back, side, 1.5);
  }

  private emit(at: THREE.Vector3, back: THREE.Vector3, side: number, power: number) {
    const e = this.e;
    const r = Math.random;
    e.x = at.x + (r() - 0.5) * 0.3; e.y = at.y + 0.04; e.z = at.z + (r() - 0.5) * 0.3;
    e.floor = at.y - FLOOR_DROP;
    // indietro, verso l'esterno e in alto, con dispersione; parte della velocità del kart ereditata
    const sp = (2.5 + r() * 4) * power;
    const out = side * (1 + r() * 2.2) * power;
    e.vx = this.kv.x * INHERIT + back.x * sp - back.z * out + (r() - 0.5) * 1.5;
    e.vy = (0.8 + r() * 1.8) * power;
    e.vz = this.kv.z * INHERIT + back.z * sp + back.x * out + (r() - 0.5) * 1.5;
    e.life = 0.3 + r() * 0.2;
    e.size0 = 0.25 + r() * 0.35;
    e.size1 = 0.05;
    e.hot = 0.5 + r() * 0.5;
    e.gravity = GRAVITY;
    e.drag = 1.2;
    this.pool.emit(e);
  }

  dispose() {
    this.scene.remove(this.pool.points);
    this.pool.dispose();
  }
}
