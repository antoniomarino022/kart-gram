import * as THREE from "three";

const VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
attribute float aSize;
attribute float aHot;
uniform float uScale;
uniform float uMaxPx;
varying vec3 vColor;
varying float vAlpha;
varying float vHot;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vHot = aHot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // limite in pixel: le particelle che passano vicino alla camera non diventano palloni
  gl_PointSize = aAlpha <= 0.0 ? 0.0 : clamp(aSize * uScale / max(0.1, -mv.z), 1.5, uMaxPx * uScale);
  gl_Position = projectionMatrix * mv;
}`;

// alone morbido (gradiente radiale) con nucleo bianco caldo. Blending "premoltiplicato": il colore copre in
// parte lo sfondo (l'arancio resta arancio anche sulla strada blu, in additivo diventerebbe rosa) e il nucleo brilla.
const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vHot;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float glow = exp(-r2 * 5.0) * (1.0 - r2) * 0.8;
  float core = exp(-r2 * 70.0) * vHot * 0.55;
  vec3 c = (vColor * glow + vec3(core)) * vAlpha;
  float a = min(1.0, max(glow, core) * vAlpha);
  if (a < 0.004) discard;
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;

const ATTRS = ["position", "aColor", "aAlpha", "aSize", "aHot"] as const;

/** Parametri di emissione riusabili (niente allocazioni per particella). */
export interface Emit {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  /** Diametro (m) a inizio e fine vita. */
  size0: number; size1: number;
  /** Colore a inizio e fine vita. */
  c0: THREE.Color; c1: THREE.Color;
  /** Intensità del nucleo bianco (0..1). */
  hot: number;
  gravity: number;
  /** Smorzamento della velocità (1/s). */
  drag: number;
  /** Quota del suolo per un rimbalzo (null: nessun suolo). */
  floor: number | null;
}

export const newEmit = (): Emit => ({
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.4, size0: 0.4, size1: 0.1,
  c0: new THREE.Color(1, 1, 1), c1: new THREE.Color(1, 0.5, 0.1), hot: 1, gravity: 0, drag: 0, floor: null,
});

const NO_FLOOR = -1e9;

/**
 * Pool di particelle luminose in un solo `Points` (una draw call). A pool pieno si ricicla la
 * particella più vecchia: le particelle vive non superano mai la capacità.
 */
export class ParticlePool {
  readonly points: THREE.Points;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private alpha: Float32Array;
  private size: Float32Array;
  private sizes: Float32Array;
  private hot: Float32Array;
  private hot0: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private floor: Float32Array;
  /** 0 = in volo, 1 = già rimbalzata, 2 = ferma a terra. */
  private bounce: Uint8Array;
  private next = 0;
  private live = 0;

  /** `maxPx`: diametro massimo a schermo, in frazione di `scale` (≈ altezza dello schermo / 1.4). */
  constructor(readonly capacity: number, renderOrder = 3, maxPx = 0.05) {
    const n = capacity;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.c0 = new Float32Array(n * 3);
    this.c1 = new Float32Array(n * 3);
    this.alpha = new Float32Array(n);
    this.size = new Float32Array(n);
    this.sizes = new Float32Array(n * 2);
    this.hot = new Float32Array(n);
    this.hot0 = new Float32Array(n);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1);
    this.grav = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.floor = new Float32Array(n);
    this.bounce = new Uint8Array(n);
    const dyn = (a: Float32Array, k: number) => new THREE.BufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", dyn(this.pos, 3));
    this.geometry.setAttribute("aColor", dyn(this.col, 3));
    this.geometry.setAttribute("aAlpha", dyn(this.alpha, 1));
    this.geometry.setAttribute("aSize", dyn(this.size, 1));
    this.geometry.setAttribute("aHot", dyn(this.hot, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 400 }, uMaxPx: { value: maxPx } },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    this.points.visible = false;
  }

  /** Particelle vive (≤ capacity). */
  get liveCount() { return this.live; }

  emit(e: Emit) {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    if (this.age[i] >= this.life[i]) this.live++;
    const i3 = i * 3;
    this.pos[i3] = e.x; this.pos[i3 + 1] = e.y; this.pos[i3 + 2] = e.z;
    this.vel[i3] = e.vx; this.vel[i3 + 1] = e.vy; this.vel[i3 + 2] = e.vz;
    this.c0[i3] = e.c0.r; this.c0[i3 + 1] = e.c0.g; this.c0[i3 + 2] = e.c0.b;
    this.c1[i3] = e.c1.r; this.c1[i3 + 1] = e.c1.g; this.c1[i3 + 2] = e.c1.b;
    this.col[i3] = e.c0.r; this.col[i3 + 1] = e.c0.g; this.col[i3 + 2] = e.c0.b;
    this.sizes[i * 2] = e.size0; this.sizes[i * 2 + 1] = e.size1;
    this.size[i] = e.size0;
    this.hot0[i] = this.hot[i] = e.hot;
    this.alpha[i] = 1;
    this.age[i] = 0;
    this.life[i] = Math.max(0.01, e.life);
    this.grav[i] = e.gravity;
    this.drag[i] = e.drag;
    this.floor[i] = e.floor ?? NO_FLOOR;
    this.bounce[i] = 0;
    this.points.visible = true;
  }

  /** `scale`: pixel per metro a distanza 1. */
  update(dt: number, scale: number) {
    this.material.uniforms.uScale.value = scale;
    if (this.live === 0) return;
    let live = 0;
    const { pos, vel, col, c0, c1 } = this;
    for (let i = 0; i < this.capacity; i++) {
      const life = this.life[i];
      if (this.age[i] >= life) continue;
      const a = (this.age[i] = Math.min(life, this.age[i] + dt));
      const t = a / life;
      if (t >= 1) { this.alpha[i] = 0; continue; }
      live++;
      const i3 = i * 3;
      if (this.bounce[i] < 2) {
        const damp = Math.exp(-this.drag[i] * dt);
        vel[i3] *= damp; vel[i3 + 1] *= damp; vel[i3 + 2] *= damp;
        vel[i3 + 1] -= this.grav[i] * dt;
        pos[i3] += vel[i3] * dt;
        pos[i3 + 1] += vel[i3 + 1] * dt;
        pos[i3 + 2] += vel[i3 + 2] * dt;
        const f = this.floor[i];
        if (pos[i3 + 1] < f && vel[i3 + 1] < 0) {
          pos[i3 + 1] = f;
          if (this.bounce[i] === 0) {
            // un solo rimbalzo, poi la scintilla resta a terra a spegnersi
            vel[i3 + 1] *= -0.35; vel[i3] *= 0.6; vel[i3 + 2] *= 0.6;
            this.bounce[i] = 1;
          } else this.bounce[i] = 2;
        }
      }
      const s0 = this.sizes[i * 2], s1 = this.sizes[i * 2 + 1];
      this.size[i] = s0 + (s1 - s0) * t;
      col[i3] = c0[i3] + (c1[i3] - c0[i3]) * t;
      col[i3 + 1] = c0[i3 + 1] + (c1[i3 + 1] - c0[i3 + 1]) * t;
      col[i3 + 2] = c0[i3 + 2] + (c1[i3 + 2] - c0[i3 + 2]) * t;
      this.hot[i] = this.hot0[i] * (1 - t);
      this.alpha[i] = 1 - t * t;
    }
    this.live = live;
    this.points.visible = live > 0;
    for (const name of ATTRS) this.geometry.getAttribute(name).needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
