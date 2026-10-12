import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GameState } from "../core/sim";
import { sampleAt } from "../core/track";
import { Decorations } from "./decorations";
import { ItemMeshes } from "./itemMeshes";
import { KartRig, type Loadout } from "./kart";
import type { ModelLibrary } from "./models";
import { biomeAt } from "./palette";
import { TrackMeshes } from "./trackMesh";
import { Trail } from "./trail";

export type { Loadout } from "./kart";
export { ALL_MODEL_NAMES } from "./models";

export interface KartPose { x: number; y: number; angle: number; elevation: number }

const HALF_PI = Math.PI / 2;
const CAM_BACK = 7, CAM_UP = 3.8, LOOK_AHEAD = 8, LOOK_UP = 0.5;
const FOV = 60, FOV_TURBO = 72;
const DRIFT_YAW = 0.35, DRIFT_ROLL = 0.08, DRIFT_EASE_TIME = 0.15;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 600);
  private hemi = new THREE.HemisphereLight("#ffffff", "#8c8ca6", 2);
  private sun = new THREE.DirectionalLight("#ffffff", 1.6);
  private fog: THREE.Fog;
  private sky: THREE.Color;
  private light = 1;
  private envMap: THREE.Texture | null = null;

  private track: TrackMeshes;
  private items: ItemMeshes;
  private deco: Decorations;
  private trail: Trail;
  private kart: KartRig;

  private time = 0;
  private first = true;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private camHeading = 0;
  private fallCamY: number | null = null;
  private fallLookY = 0;
  private drift = 0;
  private driftSign = 1;
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private size = new THREE.Vector2();
  private targetColor = new THREE.Color();

  constructor(private canvas: HTMLCanvasElement, models: ModelLibrary, loadout: Loadout) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const pal = biomeAt(0);
    this.sky = new THREE.Color(pal.sky);
    this.fog = new THREE.Fog(pal.fog, 80, 320);
    this.scene.fog = this.fog;
    this.scene.background = this.sky;

    this.sun.position.set(-0.4, 1, 0.3);
    this.scene.add(this.hemi, this.sun);

    if (loadout.paint.finish === "metal") {
      // riflessi per la vernice metallizzata (solo sul materiale della vernice)
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.envMap = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      pmrem.dispose();
    }

    this.track = new TrackMeshes(this.scene);
    this.items = new ItemMeshes(this.scene, models);
    this.deco = new Decorations(this.scene, models);
    this.trail = new Trail(this.scene, loadout.trailColor, loadout.trailId);
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
    this.camera.updateProjectionMatrix();
  }

  /** prev/curr: pose del kart al tick precedente/corrente; alpha in [0,1] */
  render(state: GameState, prev: KartPose, alpha: number, frameDt: number) {
    const dt = frameDt;
    this.time += dt;
    const k = state.kart;
    const running = state.phase === "running";
    const falling = state.phase === "falling";

    this.updateBiome(state.biome, dt);

    // posa interpolata del kart
    const x = prev.x + (k.x - prev.x) * alpha;
    const y = prev.y + (k.y - prev.y) * alpha;
    const elev = prev.elevation + (k.elevation - prev.elevation) * alpha;
    const angle = prev.angle + angleDiff(k.angle, prev.angle) * alpha;
    const yaw = angle - HALF_PI;

    const e0 = sampleAt(state.track, k.s - 1).elevation, e1 = sampleAt(state.track, k.s + 1).elevation;
    const pitch = falling ? Math.atan2(e1 - e0, 2) - Math.min(0.9, k.fallDepth * 0.12) : Math.atan2(e1 - e0, 2);
    const root = this.kart.root;
    root.position.set(x, elev - k.fallDepth, -y);
    root.rotation.set(pitch, yaw, 0);

    // drift visivo: yaw extra verso l'interno della curva e leggero rollio
    if (k.drifting) this.driftSign = state.lastCurveSign;
    this.drift = Math.max(0, Math.min(1, this.drift + (k.drifting ? dt : -dt) / DRIFT_EASE_TIME));
    const d = smoothstep(this.drift);
    this.kart.pivot.rotation.set(0, DRIFT_YAW * this.driftSign * d, -DRIFT_ROLL * this.driftSign * d);

    const turbo = state.powerups.turbo > 0;
    this.kart.update({
      speed: k.speed, dt, time: this.time,
      blink: state.invulnTimer > 0 && Math.floor(this.time * 12) % 2 === 0,
      turbo, shield: state.powerups.shield > 0, falling: !running && k.fallDepth > 0,
      spin: state.phase !== "over",
    });
    root.updateMatrixWorld(true);

    this.updateCamera(x, elev, -y, angle, falling, dt, turbo);

    this.track.update(state.track, k.s, state.powerups.wide > 0);
    this.items.update(state, alpha, this.time);
    this.deco.update(state.track, k.s, dt, this.time);

    this.renderer.getDrawingBufferSize(this.size);
    const pxPerMeter = this.size.y / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.trail.update(running && k.drifting, this.kart.rearWheel(-1, this.v1), this.kart.rearWheel(1, this.v2), dt, this.time, pxPerMeter);

    this.renderer.render(this.scene, this.camera);
  }

  private updateBiome(biome: number, dt: number) {
    const pal = biomeAt(biome);
    const t = this.first ? 1 : smooth(3, dt);
    this.sky.lerp(this.targetColor.set(pal.sky), t);
    this.fog.color.lerp(this.targetColor.set(pal.fog), t);
    this.light += (pal.light - this.light) * t;
    this.hemi.intensity = 2 * this.light;
    this.sun.intensity = 1.6 * this.light;
  }

  private updateCamera(kx: number, ky: number, kz: number, angle: number, falling: boolean, dt: number, turbo: boolean) {
    const kh = this.first ? 1 : smooth(5, dt);
    this.camHeading += angleDiff(angle, this.camHeading) * kh;
    const fx = Math.cos(this.camHeading), fz = -Math.sin(this.camHeading);

    // in caduta la camera non scende: il kart esce dall'inquadratura
    if (falling) {
      if (this.fallCamY === null) { this.fallCamY = this.camPos.y; this.fallLookY = this.camLook.y; }
    } else this.fallCamY = null;

    const tx = kx - fx * CAM_BACK, tz = kz - fz * CAM_BACK;
    const ty = this.fallCamY ?? ky + CAM_UP;
    const lx = kx + fx * LOOK_AHEAD, lz = kz + fz * LOOK_AHEAD;
    const ly = this.fallCamY !== null ? this.fallLookY : ky + LOOK_UP;

    const kp = this.first ? 1 : smooth(8, dt);
    this.camPos.x += (tx - this.camPos.x) * kp;
    this.camPos.y += (ty - this.camPos.y) * kp;
    this.camPos.z += (tz - this.camPos.z) * kp;
    this.camLook.x += (lx - this.camLook.x) * kp;
    this.camLook.y += (ly - this.camLook.y) * kp;
    this.camLook.z += (lz - this.camLook.z) * kp;
    this.first = false;

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    const fov = turbo ? FOV_TURBO : FOV;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * smooth(4, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    // geometrie e materiali dei modelli appartengono alla ModelLibrary (condivisa tra partite): non si toccano
    this.track.dispose();
    this.items.dispose();
    this.deco.dispose();
    this.trail.dispose();
    this.kart.dispose();
    this.envMap?.dispose();
    this.scene.clear();
    this.renderer.dispose();
  }
}
