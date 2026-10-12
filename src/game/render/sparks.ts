import * as THREE from "three";

const POOL = 64;
const LIFE = 0.28;
/** Scintille al secondo per angolo. */
const RATE = 36;
const GRAVITY = 9;

const VERTEX = /* glsl */ `
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(2.0, 0.16 * uScale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

// stellina a 4 punte, additiva
const FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 p = abs(gl_PointCoord * 2.0 - 1.0);
  float star = max(1.0 - (p.x * 4.0 + p.y), 1.0 - (p.y * 4.0 + p.x));
  float core = 1.0 - smoothstep(0.0, 0.45, length(p));
  float m = clamp(max(star, core), 0.0, 1.0) * vAlpha;
  if (m < 0.01) discard;
  gl_FragColor = vec4(vColor * m, m);
  #include <colorspace_fragment>
}`;

const ATTRS = ["position", "aColor", "aAlpha"] as const;
const WHITE = new THREE.Color("#ffffff");
const YELLOW = new THREE.Color("#ffd84a");

/** Scintille del drift: piccoli punti luminosi che schizzano dalla ruota posteriore esterna alla curva. */
export class Sparks {
  private geometry = new THREE.BufferGeometry();
  private material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uScale: { value: 400 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private points: THREE.Points;
  private pos = new Float32Array(POOL * 3);
  private vel = new Float32Array(POOL * 3);
  private col = new Float32Array(POOL * 3);
  private alpha = new Float32Array(POOL);
  private age = new Float32Array(POOL).fill(LIFE);
  private next = 0;
  private acc = 0;
  private live = false;

  constructor(private scene: THREE.Scene) {
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
  }

  /**
   * `wheel`: ruota posteriore esterna, `side`: suo lato (-1 sinistra, 1 destra) per la spinta verso l'esterno.
   * `back`: direzione mondo verso il retro del kart (normalizzata).
   */
  update(emitting: boolean, wheel: THREE.Vector3, side: -1 | 1, back: THREE.Vector3, dt: number, scale: number) {
    this.material.uniforms.uScale.value = scale;
    if (emitting) {
      this.acc += dt * RATE * 2;
      while (this.acc >= 1) {
        this.acc -= 1;
        this.emit(wheel, back, side);
      }
    } else this.acc = 0;
    if (!this.live) return;

    let any = false;
    for (let i = 0; i < POOL; i++) {
      if (this.age[i] >= LIFE) continue;
      const a = (this.age[i] = Math.min(LIFE, this.age[i] + dt));
      const t = a / LIFE;
      this.vel[i * 3 + 1] -= GRAVITY * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = t >= 1 ? 0 : 1 - t * t;
      if (t < 1) any = true;
    }
    this.live = any;
    for (const name of ATTRS) this.geometry.getAttribute(name).needsUpdate = true;
  }

  private emit(at: THREE.Vector3, back: THREE.Vector3, side: number) {
    const i = this.next;
    this.next = (this.next + 1) % POOL;
    this.age[i] = 0;
    this.pos[i * 3] = at.x; this.pos[i * 3 + 1] = at.y + 0.05; this.pos[i * 3 + 2] = at.z;
    // indietro, verso l'esterno e in alto, con un po' di dispersione
    const sp = 2.5 + Math.random() * 3;
    const out = side * (0.8 + Math.random() * 1.5);
    this.vel[i * 3] = back.x * sp - back.z * out + (Math.random() - 0.5);
    this.vel[i * 3 + 1] = 1.2 + Math.random() * 2;
    this.vel[i * 3 + 2] = back.z * sp + back.x * out + (Math.random() - 0.5);
    const c = Math.random() < 0.5 ? WHITE : YELLOW;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.alpha[i] = 1;
    this.live = true;
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
