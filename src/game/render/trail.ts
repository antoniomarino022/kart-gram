import * as THREE from "three";

const POOL = 120;
const LIFE = 0.6;
/** Particelle al secondo per ruota. */
const RATE = 50;

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
    mask = 1.0 - smoothstep(0.35, 1.0, r);
  }
  if (mask * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, mask * vAlpha);
  #include <colorspace_fragment>
}`;

/** Scia del drift: pool di particelle dietro le ruote posteriori, svanisce in 0.6 s. */
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
  private baseSize: number;

  constructor(scene: THREE.Scene, color: string, private trailId: string) {
    this.color.set(color);
    this.baseSize = trailId === "trail_stars" ? 0.4 : 0.28;
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

  /** `scale`: pixel per metro a distanza 1 (altezza del buffer / (2 tan(fov/2))). */
  update(emitting: boolean, left: THREE.Vector3, right: THREE.Vector3, dt: number, time: number, scale: number) {
    this.material.uniforms.uScale.value = scale;
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
      this.alpha[i] = t >= 1 ? 0 : 0.7 * (1 - t);
      this.size[i] = this.baseSize * (1 + t * 1.3);
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
    this.col[i * 3] = c.r;
    this.col[i * 3 + 1] = c.g;
    this.col[i * 3 + 2] = c.b;
    this.alpha[i] = 0.7;
    this.size[i] = this.baseSize;
    this.live = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
