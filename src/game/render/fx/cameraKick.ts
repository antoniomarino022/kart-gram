/** Spostamento massimo della camera (m) e rotazione massima (rad, ~2°). */
export const MAX_OFFSET = 0.25;
export const MAX_ROT = (2 * Math.PI) / 180;
/** Molla smorzata: rigidità e smorzamento (sottosmorzata: un paio di oscillazioni rapide). */
const STIFF = 260, DAMP = 14;
/** Rotazione per metro di spostamento. */
const ROT_PER_M = MAX_ROT / MAX_OFFSET;
/** Il colpo di FOV si spegne con questo tasso (1/s). */
const FOV_DECAY = 5;
const MAX_FOV = 14;

export interface Dir { x: number; y: number; z: number }

const clamp = (v: number, m: number) => (v > m ? m : v < -m ? -m : v);

/**
 * "Calcio" della camera: molla smorzata in spazio camera (x destra, y su, z indietro) che parte da un impulso
 * e torna a 0. Produce uno spostamento (≤ MAX_OFFSET) e una rotazione (pitch/roll, ≤ MAX_ROT), più un colpo di FOV.
 */
export class CameraKick {
  /** Spostamento in spazio camera (m). */
  readonly offset = { x: 0, y: 0, z: 0 };
  /** Rotazione (rad): pitch attorno a x, roll attorno a z. */
  pitch = 0;
  roll = 0;
  /** Gradi di FOV da aggiungere. */
  fov = 0;
  private vel = { x: 0, y: 0, z: 0 };
  private rollSign = 1;

  /**
   * `strength` 0..1 (1 = colpo forte), `dir`: direzione dell'impulso in spazio camera (non serve normalizzata).
   * Il roll alterna il verso a ogni colpo, così colpi ripetuti non sbilanciano la camera.
   */
  kick(strength: number, dir: Dir) {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    // velocità iniziale tale che il picco della molla resti vicino a MAX_OFFSET * strength
    const v = strength * MAX_OFFSET * Math.sqrt(STIFF) * 1.6;
    this.vel.x += (dir.x / len) * v;
    this.vel.y += (dir.y / len) * v;
    this.vel.z += (dir.z / len) * v;
    this.rollSign = -this.rollSign;
  }

  /** Colpo di FOV (gradi), es. sul boost. */
  punchFov(deg: number) { this.fov = Math.min(MAX_FOV, this.fov + deg); }

  update(dt: number) {
    if (dt <= 0) return;
    // sotto-passi per stabilità con frame lunghi
    const steps = Math.min(8, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    const o = this.offset, v = this.vel;
    for (let i = 0; i < steps; i++) {
      v.x += (-STIFF * o.x - DAMP * v.x) * h;
      v.y += (-STIFF * o.y - DAMP * v.y) * h;
      v.z += (-STIFF * o.z - DAMP * v.z) * h;
      o.x = clamp(o.x + v.x * h, MAX_OFFSET);
      o.y = clamp(o.y + v.y * h, MAX_OFFSET);
      o.z = clamp(o.z + v.z * h, MAX_OFFSET);
    }
    if (Math.abs(o.x) + Math.abs(o.y) + Math.abs(o.z) + Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) < 1e-4) {
      o.x = o.y = o.z = v.x = v.y = v.z = 0;
    }
    this.pitch = clamp(o.y * ROT_PER_M, MAX_ROT);
    this.roll = clamp((o.x + Math.abs(o.y) * this.rollSign * 0.5) * ROT_PER_M, MAX_ROT);
    this.fov *= Math.exp(-FOV_DECAY * dt);
    if (this.fov < 0.01) this.fov = 0;
  }

  get active() { return this.offset.x !== 0 || this.offset.y !== 0 || this.offset.z !== 0 || this.fov !== 0; }
}
