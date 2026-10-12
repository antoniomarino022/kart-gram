import * as THREE from "three";
import { STEP } from "../core/config";
import type { Track } from "../core/track";
import type { SceneColors } from "./palette";

/** Il suolo sta così tanto sotto il punto più basso della strada visibile: abbastanza vicino da leggersi come pavimento. */
export const GROUND_DEPTH = 9;
/** Base degli edifici: sempre sotto il suolo, che li taglia alla quota giusta. */
export const BUILDING_BASE = -60;
/** Tratto di strada (m) di cui si cerca il punto più basso. */
const LOW_BEHIND = 30, LOW_AHEAD = 260;
const SKY_RADIUS = 500;
const GROUND_SIZE = 1400;

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // sempre sul piano lontano
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float t = smoothstep(-0.02, 0.55, vDir.y);
  gl_FragColor = vec4(mix(uHorizon, uTop, t), 1.0);
  #include <colorspace_fragment>
}`;

/** Cielo a gradiente (sfera invertita che segue la camera) e piano del suolo che segue il kart. */
export class Environment {
  private skyGeo = new THREE.SphereGeometry(SKY_RADIUS, 24, 12);
  private skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  private sky = new THREE.Mesh(this.skyGeo, this.skyMat);
  private groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2);
  // non illuminato: il suolo ha esattamente il colore della palette, poi sfuma nella nebbia
  private groundMat = new THREE.MeshBasicMaterial();
  private ground = new THREE.Mesh(this.groundGeo, this.groundMat);

  constructor(private scene: THREE.Scene) {
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky, this.ground);
  }

  private groundY: number | null = null;

  update(colors: SceneColors, camera: THREE.Camera, track: Track, kartS: number, kartX: number, kartZ: number, dt: number) {
    this.skyMat.uniforms.uTop.value.copy(colors.sky);
    this.skyMat.uniforms.uHorizon.value.copy(colors.horizon);
    this.sky.position.copy(camera.position);
    this.groundMat.color.copy(colors.ground);
    this.ground.position.x = kartX;
    this.ground.position.z = kartZ;
    // il suolo resta sotto la strada visibile (che sale e scende), con transizioni morbide
    const S = track.samples;
    const i0 = Math.max(0, Math.floor((kartS - LOW_BEHIND) / STEP)), i1 = Math.min(S.length - 1, Math.ceil((kartS + LOW_AHEAD) / STEP));
    let low = Infinity;
    for (let i = i0; i <= i1; i += 2) low = Math.min(low, S[i].elevation);
    const target = (Number.isFinite(low) ? low : 0) - GROUND_DEPTH;
    this.groundY = this.groundY === null ? target : this.groundY + (target - this.groundY) * (1 - Math.exp(-0.8 * dt));
    this.ground.position.y = this.groundY;
  }

  dispose() {
    this.scene.remove(this.sky, this.ground);
    this.skyGeo.dispose();
    this.skyMat.dispose();
    this.groundGeo.dispose();
    this.groundMat.dispose();
  }
}
