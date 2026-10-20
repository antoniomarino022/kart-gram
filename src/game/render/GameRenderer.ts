import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GameEvent, GameState } from "../core/sim";
import { CONFIG } from "../core/config";
import { sampleAt } from "../core/track";
import { Buildings } from "./buildings";
import { Environment } from "./environment";
import { Fx } from "./fx";
import { ItemMeshes } from "./itemMeshes";
import { KartRig, type Loadout } from "./kart";
import type { ModelLibrary } from "./models";
import { biomeAt, SceneColors } from "./palette";
import { Sparks } from "./sparks";
import { Streaks } from "./streaks";
import { TrackMeshes } from "./trackMesh";
import { Trail } from "./trail";

export type { Loadout } from "./kart";
export { ALL_MODEL_NAMES } from "./models";

export interface KartPose { x: number; y: number; angle: number; moveAngle: number; yawRate: number; elevation: number }

const HALF_PI = Math.PI / 2;
/** Camera bassa e vicina (schermo orizzontale): dietro di CAM_BACK, alta CAM_UP, guarda LOOK_AHEAD avanti e LOOK_UP sopra il kart. */
const CAM_BACK = 4.8, CAM_UP = 2.3, LOOK_AHEAD = 6, LOOK_UP = 0.8;
/** In verticale (telefono) l'inquadratura è stretta: camera un po' più indietro e FOV più ampio, così il kart resta ~1/3 della larghezza. */
const CAM_BACK_PORTRAIT = 6.6, CAM_UP_PORTRAIT = 3, FOV_PORTRAIT = 70;
/** Peso della direzione di moto del kart (il resto è la tangente della strada) nello yaw della camera. */
const CAM_KART_WEIGHT = 0.35;
/** Rollio della camera verso l'interno della curva: rad per rad/s di velocità angolare, al massimo 3°. */
const CAM_ROLL_PER_YAW = 0.012, CAM_ROLL_MAX = 0.052;
/** La tangente si legge poco più avanti del kart, così la camera anticipa le curve. */
const TANGENT_AHEAD = 3;
const FOG_NEAR = 40, FOG_FAR = 280;
const FOV = 60, FOV_TURBO_BONUS = 8, FOV_BOOST_BONUS = 5;
/** Gradi di FOV in più dalla velocità base a quella massima (bioma massimo e combo x5): 70 → 80 in verticale. */
const FOV_SPEED_BONUS = 10;
const TOP_SPEED = CONFIG.speed.max * (1 + CONFIG.speed.comboBonus * (CONFIG.comboMax - 1));
/** Carrozzeria: rollio verso l'esterno (rad per rad/s, max), schiacciamento in curva, sterzata visiva delle ruote. */
const BODY_ROLL = 0.03, BODY_ROLL_MAX = 0.14, BODY_SQUASH = 0.05, WHEEL_STEER = 0.4;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 600);
  private hemi = new THREE.HemisphereLight("#ffffff", "#8c8ca6", 2.2);
  private sun = new THREE.DirectionalLight("#ffffff", 0.9);
  private fog: THREE.Fog;
  private colors: SceneColors;
  private envMap: THREE.Texture | null = null;

  private track: TrackMeshes;
  private items: ItemMeshes;
  private env: Environment;
  private buildings: Buildings;
  private trail: Trail;
  private sparks: Sparks;
  private streaks: Streaks;
  private kart: KartRig;
  private fx = new Fx(this.scene);

  private time = 0;
  private first = true;
  private camY = 0;
  private camLookY = 0;
  private camHeading = 0;
  private fallCamY: number | null = null;
  private fallLookY = 0;
  private camRoll = 0;
  private wheelSteer = 0;
  /** Lato esterno alla curva (+1 destra), per fumo e scintille. */
  private outerSide: -1 | 1 = 1;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private v4 = new THREE.Vector3();
  private size = new THREE.Vector2();
  /** 0 = orizzontale, 1 = verticale stretto (da aspect). */
  private portrait = 0;

  constructor(private canvas: HTMLCanvasElement, models: ModelLibrary, loadout: Loadout) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.colors = new SceneColors(biomeAt(0));
    this.fog = new THREE.Fog(this.colors.horizon.clone(), FOG_NEAR, FOG_FAR);
    this.scene.fog = this.fog;

    // luce morbida: emisferica forte + direzionale debole da dietro-sopra (la strada procede verso -z)
    this.sun.position.set(0.35, 1, 0.8);
    this.scene.add(this.hemi, this.sun);

    if (loadout.paint.finish === "metal") {
      // riflessi per la vernice metallizzata (solo sul materiale della vernice)
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.envMap = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
    }

    this.env = new Environment(this.scene);
    this.track = new TrackMeshes(this.scene);
    this.items = new ItemMeshes(this.scene, models);
    this.buildings = new Buildings(this.scene);
    this.trail = new Trail(this.scene, loadout.trailColor, loadout.trailId);
    this.sparks = new Sparks(this.scene, loadout.trailColor);
    this.streaks = new Streaks(this.scene);
    this.kart = new KartRig(models, loadout, this.envMap);
    this.scene.add(this.kart.root);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.portrait = Math.max(0, Math.min(1, (1.3 - w / h) / 0.8));
    this.camera.updateProjectionMatrix();
  }

  /** prev/curr: pose del kart al tick precedente/corrente; alpha in [0,1] */
  render(state: GameState, prev: KartPose, alpha: number, frameDt: number) {
    const dt = frameDt;
    this.time += dt;
    this.fx.restore(this.camera);
    const k = state.kart;
    const running = state.phase === "running";
    const falling = state.phase === "falling";

    this.updateBiome(state.biome, dt);

    // posa interpolata del kart
    const x = prev.x + (k.x - prev.x) * alpha;
    const y = prev.y + (k.y - prev.y) * alpha;
    const elev = prev.elevation + (k.elevation - prev.elevation) * alpha;
    const angle = prev.angle + angleDiff(k.angle, prev.angle) * alpha;
    const moveAngle = prev.moveAngle + angleDiff(k.moveAngle, prev.moveAngle) * alpha;
    const yawRate = prev.yawRate + (k.yawRate - prev.yawRate) * alpha;
    // il corpo segue il muso vero: la derapata si vede perché il muso punta dentro la curva mentre il kart scivola
    const yaw = angle - HALF_PI;

    const e0 = sampleAt(state.track, k.s - 1).elevation, e1 = sampleAt(state.track, k.s + 1).elevation;
    const pitch = falling ? Math.atan2(e1 - e0, 2) - Math.min(0.9, k.fallDepth * 0.12) : Math.atan2(e1 - e0, 2);
    const root = this.kart.root;
    root.position.set(x, elev + (k.jumpHeight ?? 0) - k.fallDepth, -y);
    root.rotation.set(pitch, yaw, 0);

    // rollio verso l'esterno e leggero schiacciamento proporzionali alla velocità angolare; ruote anteriori che sterzano
    const roll = Math.max(-BODY_ROLL_MAX, Math.min(BODY_ROLL_MAX, -BODY_ROLL * yawRate));
    this.kart.pivot.rotation.set(0, 0, roll);
    const squash = Math.min(1, Math.abs(yawRate) / 3) * BODY_SQUASH;
    this.kart.pivot.scale.set(1 + squash * 0.5, 1 - squash, 1);
    this.wheelSteer += ((running && k.drifting ? state.lastSteer * WHEEL_STEER : 0) - this.wheelSteer) * smooth(14, dt);
    this.kart.steerWheels(this.wheelSteer);
    const slip = angleDiff(angle, moveAngle);
    if (Math.abs(slip) > 0.01) this.outerSide = slip > 0 ? 1 : -1;

    const turbo = state.powerups.turbo > 0;
    const ghost = state.powerups.ghost > 0;
    const boost = running && state.boostTimer > 0;
    this.kart.update({
      speed: k.speed, dt, time: this.time,
      blink: state.invulnTimer > 0 && Math.floor(this.time * 12) % 2 === 0,
      turbo, ghost, shield: state.powerups.shield > 0, falling: !running && k.fallDepth > 0,
      spin: state.phase !== "over",
    });
    root.updateMatrixWorld(true);

    const tangent = sampleAt(state.track, k.s + TANGENT_AHEAD).angle;
    const speedFrac = Math.max(0, Math.min(1, (k.speed - CONFIG.speed.base) / (TOP_SPEED - CONFIG.speed.base)));
    const fovBonus = FOV_SPEED_BONUS * speedFrac + (turbo ? FOV_TURBO_BONUS : 0) + (boost ? FOV_BOOST_BONUS : 0);
    this.updateCamera(x, elev, -y, moveAngle, running ? yawRate : 0, tangent, falling, dt, fovBonus);
    this.env.update(this.colors, this.camera, state.track, k.s, x, -y, dt);

    this.track.update(state.track, k.s, state.powerups.wide > 0);
    this.items.update(state, alpha, this.time);
    this.buildings.update(state.track, k.s);

    this.renderer.getDrawingBufferSize(this.size);
    const pxPerMeter = this.size.y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const drifting = running && k.drifting;
    // girando a sinistra (+1) il retro scivola a destra: fumo e scintille escono soprattutto dalla ruota esterna
    const outerSide = this.outerSide;
    const outer = this.kart.rearWheel(outerSide, this.v1), inner = this.kart.rearWheel(-outerSide as -1 | 1, this.v2);
    this.trail.update(drifting, outer, inner, dt, this.time, pxPerMeter, this.colors.horizon);
    this.v3.set(-Math.cos(angle), 0, Math.sin(angle)); // retro del kart in coordinate three
    this.sparks.update(drifting, outer, outerSide, this.v3, dt, pxPerMeter);
    this.streaks.update(
      this.kart.tailLight(-1, this.v3), this.kart.tailLight(1, this.v4), this.time, dt,
      boost ? 1.4 : drifting || turbo ? 1 : 0.45, k.fallDepth === 0,
    );

    this.fx.update(state, dt, pxPerMeter, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Compila subito gli shader di tutto ciò che è ancora nascosto (effetti, power-up...): così il primo urto o la
   * prima raccolta non causano uno scatto mentre WebGL compila il programma. Da chiamare una volta a inizio partita.
   */
  warmUp() {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try {
      this.renderer.compile(this.scene, this.camera);
    } finally {
      for (const o of hidden) o.visible = false;
    }
  }

  onEvent(e: GameEvent, state: GameState) {
    this.fx.onEvent(e, state);
    if (e.type === "driftEnd" && e.seconds >= 1.5) this.trail.burst();
  }

  private updateBiome(biome: number, dt: number) {
    const c = this.colors;
    c.lerpTo(biomeAt(biome), this.first ? 1 : smooth(3, dt));
    this.fog.color.copy(c.horizon);
    this.hemi.color.copy(c.light);
    this.hemi.groundColor.copy(c.ground);
    this.hemi.intensity = 2.2 * c.intensity;
    this.sun.intensity = 0.9 * c.intensity;
  }

  /**
   * `moveAngle`: direzione di moto del kart, `tangent`: direzione della strada poco avanti (coordinate core).
   * `yawRate`: velocità angolare del muso, per un leggero rollio della camera verso l'interno della curva.
   */
  private updateCamera(kx: number, ky: number, kz: number, moveAngle: number, yawRate: number, tangent: number, falling: boolean, dt: number, fovBonus: number) {
    // yaw: soprattutto la strada, un po' il moto del kart, con un leggero ritardo: niente scatti
    const target = tangent + angleDiff(moveAngle, tangent) * CAM_KART_WEIGHT;
    this.camHeading += angleDiff(target, this.camHeading) * (this.first ? 1 : smooth(5, dt));
    const fx = Math.cos(this.camHeading), fz = -Math.sin(this.camHeading);

    // in caduta la camera non scende: il kart esce dall'inquadratura
    if (falling) {
      if (this.fallCamY === null) { this.fallCamY = this.camY; this.fallLookY = this.camLookY; }
    } else this.fallCamY = null;

    const kh = this.first ? 1 : smooth(8, dt);
    const up = CAM_UP + (CAM_UP_PORTRAIT - CAM_UP) * this.portrait;
    this.camY += ((this.fallCamY ?? ky + up) - this.camY) * kh;
    this.camLookY += ((this.fallCamY !== null ? this.fallLookY : ky + LOOK_UP) - this.camLookY) * kh;
    this.first = false;

    // distanza fissa dal kart: la morbidezza viene da yaw e altezza smussati
    const back = CAM_BACK + (CAM_BACK_PORTRAIT - CAM_BACK) * this.portrait;
    this.camera.position.set(kx - fx * back, this.camY, kz - fz * back);
    this.camera.lookAt(kx + fx * LOOK_AHEAD, this.camLookY, kz + fz * LOOK_AHEAD);
    const roll = Math.max(-CAM_ROLL_MAX, Math.min(CAM_ROLL_MAX, yawRate * CAM_ROLL_PER_YAW));
    this.camRoll += (roll - this.camRoll) * (this.first ? 1 : smooth(4, dt));
    this.camera.rotateZ(this.camRoll);

    const fov = FOV + (FOV_PORTRAIT - FOV) * this.portrait + fovBonus;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * smooth(4, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    // geometrie e materiali dei modelli appartengono alla ModelLibrary (condivisa tra partite): non si toccano
    this.track.dispose();
    this.items.dispose();
    this.env.dispose();
    this.buildings.dispose();
    this.trail.dispose();
    this.sparks.dispose();
    this.fx.dispose();
    this.streaks.dispose();
    this.kart.dispose();
    this.envMap?.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}
