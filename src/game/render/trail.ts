import * as THREE from "three";

const POOL = 128;
// fround: le età stanno in Float32Array, il confronto con un double non arriverebbe mai a fine vita
const LIFE = Math.fround(0.7);
/** Particelle al secondo per ruota. */
const RATE = 30;
/** Diametro (m) dei fumi esagonali: da GROW_FROM a GROW_TO durante la vita (piccoli: vicino alla camera sembrano enormi). */
const GROW_FROM = 0.3, GROW_TO = 0.9;
/** Opacità massima di uno sbuffo. */
const MAX_ALPHA = 0.26;
/** La ruota interna alla curva fuma meno di quella esterna. */
const INNER_RATE = 0.35;
const ATTRS = ["position", "aColor", "aAlpha", "aSize", "aRot"] as const;
/** Quanto della velocità del kart eredita uno sbuffo (così non "si stacca" di colpo dalla ruota). */
const INHERIT = 0.3;
/** Sbuffi della nuvola bianca a fine drift lungo. */
export const BIG_DRIFT_PUFFS = 16;
const BIG_ALPHA = 0.6;
/** Oltre questo salto tra due frame (revive, teletrasporto) non si stima la velocità. */
const JUMP = 3;
const WHITE = new THREE.Color("#ffffff");
/** Quanto il fumo tende al colore del bioma. */
const TINT = 0.25;

const VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
attribute float aSize;
attribute float aRot;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vRot;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vRot = vec2(cos(aRot), sin(aRot));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // diametro limitato a schermo: vicino alla camera il fumo non deve coprire la scena
  gl_PointSize = aAlpha <= 0.0 ? 0.0 : min(aSize * uScale / max(0.1, -mv.z), 0.22 * uScale);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
uniform float uStar;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vRot;
void main() {
  vec2 p0 = gl_PointCoord * 2.0 - 1.0;
  vec2 p = vec2(p0.x * vRot.x - p0.y * vRot.y, p0.x * vRot.y + p0.y * vRot.x);
  float r = length(p);
  float mask;
  if (uStar > 0.5) {
    float a = atan(p.y, p.x);
    float lim = mix(0.42, 1.0, pow(0.5 + 0.5 * cos(5.0 * a), 2.0));
    mask = 1.0 - smoothstep(lim - 0.12, lim, r);
  } else {
    // esagono morbido, un po' più chiaro al centro
    vec2 q = abs(p);
    float h = max(q.x * 0.866 + q.y * 0.5, q.y);
    mask = 1.0 - smoothstep(0.6, 0.9, h);
    mask *= 0.8 + 0.2 * (1.0 - r);
  }
  if (mask * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, mask * vAlpha);
  #include <colorspace_fragment>
}`;

/** Fumo del drift: pool di sbuffi esagonali dietro le ruote posteriori, crescono e svaniscono in 0.7 s. */
export class Trail {
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private pos = new Float32Array(POOL * 3);
  private col = new Float32Array(POOL * 3);
  private alpha = new Float32Array(POOL);
  private size = new Float32Array(POOL);
  private rot = new Float32Array(POOL);
  private spin = new Float32Array(POOL);
  private peak = new Float32Array(POOL);
  private grow = new Float32Array(POOL);
  private kv = new THREE.Vector3();
  private lastOuter = new THREE.Vector3();
  private lastInner = new THREE.Vector3();
  private hasLast = false;
  private age = new Float32Array(POOL).fill(LIFE);
  private vel = new Float32Array(POOL * 3);
  private next = 0;
  private emitAcc = 0;
  private innerAcc = 0;
  private emitted = 0;
  private live = false;
  private color = new THREE.Color();
  private stars: boolean;
  private tint = new THREE.Color();

  constructor(scene: THREE.Scene, color: string, private trailId: string) {
    this.color.set(color);
    this.stars = trailId === "trail_stars";
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aRot", new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uScale: { value: 400 }, uStar: { value: trailId === "trail_stars" ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    scene.add(this.points);
  }

  /**
   * `scale`: pixel per metro a distanza 1 (altezza del buffer / (2 tan(fov/2))).
   * `tint`: colore del bioma verso cui tende il fumo.
   * `outer`/`inner`: ruote posteriori esterna e interna alla curva.
   */
  update(emitting: boolean, outer: THREE.Vector3, inner: THREE.Vector3, dt: number, time: number, scale: number, tint: THREE.Color) {
    this.material.uniforms.uScale.value = scale;
    this.tint.copy(tint);
    if (this.hasLast && dt > 0 && this.lastOuter.distanceToSquared(outer) < JUMP * JUMP) {
      this.kv.subVectors(outer, this.lastOuter).divideScalar(dt);
    } else if (dt > 0) this.kv.set(0, 0, 0);
    this.lastOuter.copy(outer);
    this.lastInner.copy(inner);
    this.hasLast = true;
    if (emitting) {
      this.emitAcc += dt * RATE;
      this.innerAcc += dt * RATE * INNER_RATE;
      while (this.emitAcc >= 1) { this.emitAcc -= 1; this.emit(outer, time); }
      while (this.innerAcc >= 1) { this.innerAcc -= 1; this.emit(inner, time); }
    } else this.emitAcc = this.innerAcc = 0;

    if (!this.live && !emitting) return;
    let any = false;
    for (let i = 0; i < POOL; i++) {
      if (this.age[i] >= LIFE) continue;
      const a = (this.age[i] = Math.min(LIFE, this.age[i] + dt));
      const t = a / LIFE;
      this.alpha[i] = t >= 1 ? 0 : this.peak[i] * (1 - t) * Math.min(1, t * 8);
      this.size[i] = this.stars ? 0.4 * (1 + t * 1.3) : GROW_FROM + (this.grow[i] - GROW_FROM) * Math.sqrt(t);
      this.rot[i] += this.spin[i] * dt;
      const damp = Math.exp(-2.5 * dt);
      this.vel[i * 3] *= damp;
      this.vel[i * 3 + 2] *= damp;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (t < 1) any = true;
    }
    this.live = any;
    for (const name of ATTRS) this.geometry.getAttribute(name).needsUpdate = true;
  }

  /** Particelle vive (per i test). */
  get liveCount() {
    let n = 0;
    for (let i = 0; i < POOL; i++) if (this.age[i] < LIFE) n++;
    return n;
  }

  /** Nuvola densa e bianca dalle ultime posizioni delle ruote (fine di un drift lungo). */
  burst() {
    if (!this.hasLast) return;
    for (let n = 0; n < BIG_DRIFT_PUFFS; n++) {
      const i = this.emit(n % 3 === 2 ? this.lastInner : this.lastOuter, 0);
      const k = 1.5 + Math.random();
      this.vel[i * 3] = this.kv.x * 0.15 + (Math.random() - 0.5) * 2.4 * k;
      this.vel[i * 3 + 1] = 0.6 + Math.random() * 0.9;
      this.vel[i * 3 + 2] = this.kv.z * 0.15 + (Math.random() - 0.5) * 2.4 * k;
      this.col[i * 3] = this.col[i * 3] * 0.3 + WHITE.r * 0.7;
      this.col[i * 3 + 1] = this.col[i * 3 + 1] * 0.3 + WHITE.g * 0.7;
      this.col[i * 3 + 2] = this.col[i * 3 + 2] * 0.3 + WHITE.b * 0.7;
      this.peak[i] = BIG_ALPHA;
    }
  }

  private emit(at: THREE.Vector3, time: number) {
    const i = this.next;
    this.next = (this.next + 1) % POOL;
    const n = this.emitted++;
    this.age[i] = 0;
    this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.15;
    this.pos[i * 3 + 1] = at.y;
    this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.15;
    this.vel[i * 3] = this.kv.x * INHERIT + (Math.random() - 0.5) * 0.8;
    this.vel[i * 3 + 1] = 0.4 + Math.random() * 0.5;
    this.vel[i * 3 + 2] = this.kv.z * INHERIT + (Math.random() - 0.5) * 0.8;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.spin[i] = (Math.random() - 0.5) * 2.5;
    this.peak[i] = MAX_ALPHA;
    this.grow[i] = GROW_TO * (0.75 + Math.random() * 0.25);
    const c = this.trailId === "trail_rainbow" ? this.color.setHSL((time * 0.5 + n * 0.02) % 1, 1, 0.55) : this.color;
    const r = c.r + (this.tint.r - c.r) * TINT, g = c.g + (this.tint.g - c.g) * TINT, b = c.b + (this.tint.b - c.b) * TINT;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
    this.alpha[i] = 0;
    this.size[i] = this.stars ? 0.4 : GROW_FROM;
    this.live = true;
    return i;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
