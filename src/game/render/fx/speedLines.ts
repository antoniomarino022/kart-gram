import * as THREE from "three";

export const LINES = 28;

const VERTEX = /* glsl */ `
attribute vec3 aLine;   // angolo, fase, velocità
attribute vec2 aCorner; // u (0 = estremo interno, 1 = esterno), lato (-1/1)
uniform float uTime;
uniform float uIntensity;
varying float vAlpha;
void main() {
  float prog = fract(uTime * aLine.z + aLine.y);
  vec2 dir = vec2(cos(aLine.x), sin(aLine.x));
  vec2 perp = vec2(-dir.y, dir.x);
  float len = mix(0.2, 0.55, uIntensity) * (0.6 + 0.4 * fract(aLine.y * 7.13));
  float r = mix(1.5, 0.6, prog) + aCorner.x * len;
  float w = (0.003 + 0.006 * uIntensity) * aCorner.x;
  // direttamente in clip space: le linee sono "attaccate" alla camera
  gl_Position = vec4(dir * r + perp * aCorner.y * w, 0.0, 1.0);
  float fade = smoothstep(0.0, 0.2, prog) * (1.0 - smoothstep(0.75, 1.0, prog));
  vAlpha = uIntensity * fade * aCorner.x;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor * vAlpha, 1.0);
}`;

/** Intensità bersaglio delle linee: 0 sotto il 70% della velocità massima, 1 al massimo; turbo/boost almeno 0.7. */
export function speedLineTarget(speed: number, maxSpeed: number, boosted: boolean) {
  const t = Math.max(0, Math.min(1, (speed - 0.7 * maxSpeed) / (0.45 * maxSpeed)));
  return boosted ? Math.max(0.7, t) : t;
}

/**
 * Linee di velocità: sottili strisce additive che scorrono dai bordi dello schermo verso il centro.
 * Una sola draw call, tutto animato nel vertex shader (nessun aggiornamento di buffer per frame).
 */
export class SpeedLines {
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private time = 0;
  private intensity = 0;
  private pulse = 0;

  constructor(private scene: THREE.Scene) {
    const line = new Float32Array(LINES * 4 * 3);
    const corner = new Float32Array(LINES * 4 * 2);
    const index: number[] = [];
    for (let l = 0; l < LINES; l++) {
      // angoli distribuiti uniformemente con un po' di disordine; niente linee esattamente orizzontali al centro
      const ang = ((l + Math.random() * 0.8) / LINES) * Math.PI * 2;
      const phase = Math.random(), rate = 1.3 + Math.random() * 1.2;
      for (let c = 0; c < 4; c++) {
        const v = l * 4 + c;
        line[v * 3] = ang; line[v * 3 + 1] = phase; line[v * 3 + 2] = rate;
        corner[v * 2] = c < 2 ? 0 : 1;
        corner[v * 2 + 1] = c % 2 ? 1 : -1;
      }
      const b = l * 4;
      index.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    // posizione fittizia: serve a three per il conteggio dei vertici
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LINES * 4 * 3), 3));
    this.geometry.setAttribute("aLine", new THREE.BufferAttribute(line, 3));
    this.geometry.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    this.geometry.setIndex(index);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uColor: { value: new THREE.Color("#eaf8ff") } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  get level() { return this.intensity; }

  /** Picco momentaneo (boost). */
  burst(amount: number) { this.pulse = Math.max(this.pulse, amount); }

  update(dt: number, target: number) {
    this.pulse *= Math.exp(-3 * dt);
    const goal = Math.min(1, Math.max(target, this.pulse));
    // sale in fretta, scende piano
    this.intensity += (goal - this.intensity) * (1 - Math.exp(-(goal > this.intensity ? 8 : 2.5) * dt));
    if (this.intensity < 0.01 && goal === 0) this.intensity = 0;
    this.time += dt * (0.8 + this.intensity * 0.8);
    this.material.uniforms.uTime.value = this.time;
    this.material.uniforms.uIntensity.value = this.intensity;
    this.mesh.visible = this.intensity > 0.01;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
