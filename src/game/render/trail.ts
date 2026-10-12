import * as THREE from "three";

const POOL = 96;
const LIFE = 0.7;
/** Particelle al secondo per ruota. */
const RATE = 18;
/** Diametro (m) dei fumi esagonali: da GROW_FROM a GROW_TO durante la vita. */
const GROW_FROM = 0.4, GROW_TO = 1.6;
/** Quanto il fumo tende al colore del bioma. */
const TINT = 0.25;

const VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
attribute float aSize;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
uniform float uStar;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
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
  private age = new Float32Array(POOL).fill(LIFE);
  private vel = new Float32Array(POOL * 3);
  private next = 0;
  private emitAcc = 0;
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
   */
  update(emitting: boolean, left: THREE.Vector3, right: THREE.Vector3, dt: number, time: number, scale: number, tint: THREE.Color) {
    this.material.uniforms.uScale.value = scale;
    this.tint.copy(tint);
    if (emitting) {
      this.emitAcc += dt * RATE;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        this.emit(left, time);
        this.emit(right, time);
      }
    } else this.emitAcc = 0;

    if (!this.live && !emitting) return;
    let any = false;
    for (let i = 0; i < POOL; i++) {
      if (this.age[i] >= LIFE) continue;
      const a = (this.age[i] = Math.min(LIFE, this.age[i] + dt));
      const t = a / LIFE;
      this.alpha[i] = t >= 1 ? 0 : 0.5 * (1 - t) * Math.min(1, t * 8);
      this.size[i] = this.stars ? 0.4 * (1 + t * 1.3) : GROW_FROM + (GROW_TO - GROW_FROM) * Math.sqrt(t);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (t < 1) any = true;
    }
    this.live = any;
    for (const name of ["position", "aColor", "aAlpha", "aSize"]) this.geometry.getAttribute(name).needsUpdate = true;
  }

  private emit(at: THREE.Vector3, time: number) {
    const i = this.next;
    this.next = (this.next + 1) % POOL;
    const n = this.emitted++;
    this.age[i] = 0;
    this.pos[i * 3] = at.x + (Math.random() - 0.5) * 0.15;
    this.pos[i * 3 + 1] = at.y;
    this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * 0.15;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
    this.vel[i * 3 + 1] = 0.4 + Math.random() * 0.5;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    const c = this.trailId === "trail_rainbow" ? this.color.setHSL((time * 0.5 + n * 0.02) % 1, 1, 0.55) : this.color;
    const r = c.r + (this.tint.r - c.r) * TINT, g = c.g + (this.tint.g - c.g) * TINT, b = c.b + (this.tint.b - c.b) * TINT;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
    this.alpha[i] = 0;
    this.size[i] = this.stars ? 0.4 : GROW_FROM;
    this.live = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
