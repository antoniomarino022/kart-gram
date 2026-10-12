import * as THREE from "three";

/** Punti di storia per fanale (a 60 fps bastano per ~0.5 s). */
const N = 36;
const LIFE = 0.5;
const WIDTH = 0.055;
/** Oltre questo salto tra due frame (teletrasporto, revive) la scia riparte da capo. */
const JUMP = 4;
const COLOR = new THREE.Color("#ff3fa4");

/**
 * Scie luminose dei fanali (effetto lunga esposizione): due nastri orizzontali che seguono la storia
 * delle posizioni dei fanali negli ultimi 0.5 s, dal magenta al trasparente.
 */
export class Streaks {
  private geometry = new THREE.BufferGeometry();
  private material = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  private mesh: THREE.Mesh;
  private pos = new Float32Array(2 * N * 2 * 3);
  private col = new Float32Array(2 * N * 2 * 4);
  /** Storia per lato: [x, y, z] e istante, ring buffer con il più recente in head. */
  private hist = [new Float32Array(N * 3), new Float32Array(N * 3)];
  private times = new Float32Array(N).fill(-1e9);
  private head = 0;
  private count = 0;
  private bright = 0;

  constructor(private scene: THREE.Scene) {
    const posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", posAttr);
    this.geometry.setAttribute("color", colAttr);
    const index: number[] = [];
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < N - 1; i++) {
        const a = (s * N + i) * 2, b = a + 2;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.geometry.setIndex(index);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  /** `level`: intensità delle scie (0.45 normale, 1 drift/turbo, di più col boost). `visible`: false in caduta / fuori strada. */
  update(left: THREE.Vector3, right: THREE.Vector3, time: number, dt: number, level: number, visible: boolean) {
    this.mesh.visible = visible;
    if (!visible) { this.count = 0; return; }
    this.bright += (level - this.bright) * Math.min(1, dt * 6);

    const prev = this.head;
    const h0 = this.hist[0];
    if (this.count > 0 && Math.hypot(left.x - h0[prev * 3], left.z - h0[prev * 3 + 2]) > JUMP) this.count = 0;
    if (dt > 0 || this.count === 0) {
      this.head = (this.head + 1) % N;
      this.times[this.head] = time;
      this.count = Math.min(N, this.count + 1);
      this.write(0, left);
      this.write(1, right);
    }
    this.rebuild(time);
  }

  private write(side: number, p: THREE.Vector3) {
    const h = this.hist[side], j = this.head * 3;
    h[j] = p.x; h[j + 1] = p.y; h[j + 2] = p.z;
  }

  private rebuild(time: number) {
    const pos = this.pos, col = this.col;
    for (let s = 0; s < 2; s++) {
      const h = this.hist[s];
      let nx = 0, nz = 0;
      for (let i = 0; i < N; i++) {
        const k = (this.head - Math.min(i, this.count - 1) + N) % N; // oltre la storia: ripete l'ultimo punto
        const age = time - this.times[k];
        const fade = i >= this.count ? 0 : Math.max(0, 1 - age / LIFE);
        // normale orizzontale al nastro, dalla direzione verso il punto più vecchio
        const kn = (this.head - Math.min(i + 1, this.count - 1) + N) % N;
        const dx = h[kn * 3] - h[k * 3], dz = h[kn * 3 + 2] - h[k * 3 + 2];
        const len = Math.hypot(dx, dz);
        if (len > 1e-4) { nx = -dz / len; nz = dx / len; }
        const w = WIDTH * (0.4 + 0.6 * fade);
        const v = (s * N + i) * 2;
        pos[v * 3] = h[k * 3] + nx * w; pos[v * 3 + 1] = h[k * 3 + 1]; pos[v * 3 + 2] = h[k * 3 + 2] + nz * w;
        pos[v * 3 + 3] = h[k * 3] - nx * w; pos[v * 3 + 4] = h[k * 3 + 1]; pos[v * 3 + 5] = h[k * 3 + 2] - nz * w;
        const a = Math.min(1, fade * fade * 0.7 * this.bright);
        for (let e = 0; e < 2; e++) {
          const c = (v + e) * 4;
          col[c] = COLOR.r; col[c + 1] = COLOR.g; col[c + 2] = COLOR.b; col[c + 3] = a;
        }
      }
    }
    this.geometry.getAttribute("position").needsUpdate = true;
    this.geometry.getAttribute("color").needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
