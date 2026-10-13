import * as THREE from "three";
import { CONFIG } from "../../core/config";
import type { GameEvent, GameState } from "../../core/sim";
import { biomeAt } from "../palette";
import { CameraKick, type Dir } from "./cameraKick";
import { HitFx } from "./hitFx";
import { newEmit, ParticlePool } from "./particles";
import { PickupFx } from "./pickupFx";
import { speedLineTarget, SpeedLines } from "./speedLines";

/** Particelle condivise da lampi, scintille d'urto, brillantini e near miss. */
const POOL = 220;
const NEAR_MISS_SPARKS = 24;

const HIT_DIR: Dir = { x: 0, y: 0.6, z: -0.7 };
const SMASH_DIR: Dir = { x: 0, y: 0.8, z: -1 };
const FALL_DIR: Dir = { x: 0, y: -1, z: 0.2 };
const BOOST_DIR: Dir = { x: 0, y: 0, z: 1 };
const SHIELD_DIR: Dir = { x: 0, y: 0.4, z: -0.4 };

const YELLOW = new THREE.Color("#ffb52a");
const ORANGE = new THREE.Color("#ff3800");

/**
 * Effetti "juicy" solo grafici: urti, raccolte, near miss, linee di velocità e calcio della camera.
 * Unico punto d'integrazione col renderer: `onEvent` per ogni evento, `restore` prima di posizionare la
 * camera, `update` dopo (applica spostamento/rotazione/FOV del calcio).
 */
export class Fx {
  readonly kick = new CameraKick();
  private pool = new ParticlePool(POOL, 4);
  private hit: HitFx;
  private pickup: PickupFx;
  private lines: SpeedLines;
  private e = newEmit();
  private appliedFov = 0;
  private dir: Dir = { x: 0, y: 0, z: 0 };

  constructor(private scene: THREE.Scene) {
    scene.add(this.pool.points);
    this.hit = new HitFx(scene, this.pool);
    this.pickup = new PickupFx(scene, this.pool);
    this.lines = new SpeedLines(scene);
  }

  /** Spostamento della camera (spazio camera) e gradi di FOV extra correnti. */
  get cameraOffset() { return this.kick.offset; }
  get fovBoost() { return this.kick.fov; }
  get speedLineLevel() { return this.lines.level; }

  onEvent(e: GameEvent, state: GameState) {
    const k = state.kart;
    const x = k.x, y = k.elevation - k.fallDepth, z = -k.y;
    const fx = Math.cos(k.angle), fz = -Math.sin(k.angle);
    // velocità lungo la direzione di moto (in derapata il muso punta altrove)
    const vx = Math.cos(k.moveAngle) * k.speed, vz = -Math.sin(k.moveAngle) * k.speed;
    // confronto su stringa: "boost" potrebbe non esistere in tutte le versioni del core
    switch (e.type as string) {
      case "hit":
      case "smash": {
        const smash = e.type === "smash";
        this.hit.burst(x + fx * 1.1, y + 0.35, z + fz * 1.1, fx, fz, k.speed, biomeAt(state.biome).buildings, smash);
        this.dir.x = (Math.random() < 0.5 ? -1 : 1) * 0.5;
        this.dir.y = (smash ? SMASH_DIR : HIT_DIR).y;
        this.dir.z = (smash ? SMASH_DIR : HIT_DIR).z;
        this.kick.kick(smash ? 1 : 0.6, this.dir);
        break;
      }
      case "fall": this.kick.kick(0.9, FALL_DIR); break;
      case "coin": this.pickup.coin(x, y, z, vx * 0.85, vz * 0.85); break;
      case "powerup":
        this.pickup.powerup((e as { kind?: string }).kind ?? "", x, y, z, vx, vz);
        this.kick.punchFov(2);
        break;
      case "shieldUsed":
        this.pickup.powerup("shield", x, y, z, vx, vz);
        this.kick.kick(0.4, SHIELD_DIR);
        break;
      case "boost":
        this.pickup.boost(x, y, z, fx, fz, k.speed);
        this.lines.burst(1);
        this.kick.kick(0.5, BOOST_DIR);
        this.kick.punchFov(9);
        break;
      case "nearMiss": this.nearMiss(x, y, z, fx, fz, k.speed); break;
    }
  }

  /** Da chiamare prima che il renderer ricalcoli la camera: toglie il FOV extra applicato al frame prima. */
  restore(camera: THREE.PerspectiveCamera) {
    if (this.appliedFov === 0) return;
    camera.fov -= this.appliedFov;
    this.appliedFov = 0;
    camera.updateProjectionMatrix();
  }

  /** `scale`: pixel per metro a distanza 1. Da chiamare dopo aver posizionato la camera. */
  update(state: GameState, frameDt: number, scale: number, camera: THREE.PerspectiveCamera) {
    const dt = frameDt;
    const k = state.kart;
    this.pool.update(dt, scale);
    this.hit.update(dt);
    this.pickup.update(dt, k.x, k.elevation - k.fallDepth, -k.y);
    const boosted = state.powerups.turbo > 0 || (state.boostTimer ?? 0) > 0;
    this.lines.update(dt, state.phase === "running" ? speedLineTarget(k.speed, CONFIG.speed.max, boosted) : 0);

    this.kick.update(dt);
    const o = this.kick.offset;
    if (o.x !== 0 || o.y !== 0 || o.z !== 0) {
      camera.translateX(o.x);
      camera.translateY(o.y);
      camera.translateZ(o.z);
      camera.rotateX(this.kick.pitch);
      camera.rotateZ(this.kick.roll);
    }
    if (this.kick.fov !== 0) {
      camera.fov += this.kick.fov;
      this.appliedFov = this.kick.fov;
      camera.updateProjectionMatrix();
    }
  }

  /** Ventaglio di scintille dai due fianchi del kart, all'indietro. */
  private nearMiss(x: number, y: number, z: number, fx: number, fz: number, speed: number) {
    const e = this.e, r = Math.random;
    e.c0.copy(YELLOW); e.c1.copy(ORANGE);
    for (let i = 0; i < NEAR_MISS_SPARKS; i++) {
      const side = i % 2 ? 1 : -1;
      e.x = x - fz * side * 0.7 - fx * 0.6; e.y = y + 0.15; e.z = z + fx * side * 0.7 - fz * 0.6;
      const back = 3 + r() * 5, out = side * (2 + r() * 3);
      e.vx = fx * speed * 0.6 - fx * back - fz * out;
      e.vy = 1 + r() * 2.5;
      e.vz = fz * speed * 0.6 - fz * back + fx * out;
      e.life = 0.3 + r() * 0.2;
      e.size0 = 0.3 + r() * 0.3; e.size1 = 0.05; e.hot = 1;
      e.gravity = 14; e.drag = 1.2; e.floor = y - 0.02;
      this.pool.emit(e);
    }
  }

  dispose() {
    this.scene.remove(this.pool.points);
    this.pool.dispose();
    this.hit.dispose();
    this.pickup.dispose();
    this.lines.dispose();
  }
}
