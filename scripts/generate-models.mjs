// Genera i modelli segnaposto in public/models/*.glb (glTF 2.0).
// Convenzioni: 1 unita = 1 m, +Y su, il kart guarda -Z, origine alla base.
// Nei kart le mesh ricolorabili usano il materiale chiamato "paint".
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = "data:" + (blob.type || "application/octet-stream") + ";base64," + Buffer.from(b).toString("base64"); this.onloadend?.(); this.onload?.({ target: this }); }); }
};

import { mkdirSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const mats = new Map();
function mat(name, color, emissive) {
  const key = name + color + (emissive ?? "");
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, name, flatShading: true, roughness: 0.8, metalness: 0.05 });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.8; }
    mats.set(key, m);
  }
  return mats.get(key);
}

// Aggiunge una mesh al gruppo e la restituisce.
function add(g, geo, material, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
const HALF = Math.PI / 2;

const paint = (c = "#e53935") => mat("paint", c);
const dark = mat("dark", "#2b2b33");
const grey = mat("grey", "#9aa0a6");

// Pezzi comuni dei kart (senza ruote): sedile, volante.
function seat(g, y, z) {
  add(g, box(0.5, 0.35, 0.1), dark, [0, y + 0.18, z + 0.2]);
  add(g, box(0.5, 0.08, 0.4), dark, [0, y + 0.04, z]);
}
function steering(g, y, z) {
  add(g, cyl(0.03, 0.03, 0.3, 8), grey, [0, y, z], [-0.5, 0, 0]);
  add(g, box(0.4, 0.05, 0.05), dark, [0, y + 0.13, z - 0.07]);
}

function kartClassic() {
  const g = new THREE.Group();
  add(g, box(1.0, 0.35, 1.6), paint(), [0, 0.15 + 0.175, 0]);
  add(g, box(0.7, 0.12, 0.5), paint("#b71c1c"), [0, 0.15 + 0.41, -0.5]);
  seat(g, 0.5, 0.25);
  steering(g, 0.62, -0.2);
  return g;
}
function kartBolt() {
  const g = new THREE.Group();
  const spoiler = mat("spoiler", "#212121");
  add(g, box(1.0, 0.28, 1.0), paint("#fdd835"), [0, 0.29, 0.2]);
  // muso a cuneo: piramide a 4 lati schiacciata
  const nose = add(g, cyl(0.28, 0.7, 0.8, 4), paint("#fdd835"), [0, 0.29, -0.7], [-HALF, Math.PI / 4, 0]);
  nose.scale.set(1, 1, 0.4);
  add(g, box(1.1, 0.06, 0.3), spoiler, [0, 0.72, 0.8]);
  add(g, box(0.06, 0.25, 0.1), spoiler, [-0.35, 0.58, 0.8]);
  add(g, box(0.06, 0.25, 0.1), spoiler, [0.35, 0.58, 0.8]);
  seat(g, 0.43, 0.3);
  steering(g, 0.55, -0.1);
  return g;
}
function kartBrick() {
  const g = new THREE.Group();
  add(g, box(1.05, 0.6, 1.5), paint("#1e88e5"), [0, 0.15 + 0.3, 0.05]);
  add(g, box(0.9, 0.3, 0.7), paint("#1565c0"), [0, 0.15 + 0.75, 0.3]);
  add(g, box(0.9, 0.12, 0.08), mat("light", "#fff59d", "#fff59d"), [0, 0.5, -0.71]);
  seat(g, 0.78, 0.3);
  steering(g, 0.85, -0.2);
  return g;
}
function kartRocket() {
  const g = new THREE.Group();
  add(g, box(0.8, 0.3, 1.7), paint("#8e24aa"), [0, 0.3, 0]);
  // punta conica verso -Z
  const tip = add(g, cyl(0.02, 0.4, 0.5, 8), paint("#8e24aa"), [0, 0.3, -1.1], [-HALF, 0, 0]);
  tip.scale.set(1, 1, 0.75);
  for (const x of [-0.25, 0.25]) {
    add(g, cyl(0.14, 0.17, 0.4, 12), grey, [x, 0.38, 0.9], [HALF, 0, 0]);
    add(g, cyl(0.1, 0.1, 0.05, 12), mat("flame", "#ff9800", "#ff6d00"), [x, 0.38, 1.12], [HALF, 0, 0]);
  }
  seat(g, 0.45, 0.2);
  steering(g, 0.57, -0.25);
  return g;
}

function wheel({ r = 0.22, w = 0.18, rim, whitewall, tread } = {}) {
  const g = new THREE.Group();
  const tire = mat("tire", "#1c1c22");
  add(g, cyl(r, r, w, 20), tire, [0, 0, 0], [0, 0, HALF]);
  if (rim) add(g, cyl(r * 0.6, r * 0.6, w + 0.02, 16), mat("rim", rim), [0, 0, 0], [0, 0, HALF]);
  else add(g, cyl(r * 0.45, r * 0.45, w + 0.02, 12), grey, [0, 0, 0], [0, 0, HALF]);
  if (whitewall) {
    for (const s of [-1, 1]) {
      add(g, new THREE.TorusGeometry(r * 0.75, 0.025, 6, 20), mat("whitewall", "#f5f5f5"), [s * (w / 2 + 0.005), 0, 0], [0, HALF, 0]);
    }
  }
  if (tread) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(g, box(w + 0.04, 0.06, 0.07), tire, [0, Math.sin(a) * r, Math.cos(a) * r], [a, 0, 0]);
    }
  }
  return g;
}

function rivalKart() {
  const g = new THREE.Group();
  add(g, box(1.0, 0.35, 1.6), mat("rival", "#6d7278"), [0, 0.325, 0]);
  add(g, box(0.7, 0.12, 0.5), mat("rival_dark", "#4a4e53"), [0, 0.56, -0.5]);
  seat(g, 0.5, 0.25);
  steering(g, 0.62, -0.2);
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.6, 0.6]) {
      const w = wheel();
      w.position.set(x, 0.22, z);
      g.add(w);
    }
  }
  return g;
}

function obstacleCone() {
  const g = new THREE.Group();
  add(g, box(0.8, 0.06, 0.8), mat("cone_base", "#e65100"), [0, 0.03, 0]);
  add(g, cyl(0.02, 0.35, 0.7, 16), mat("cone", "#ff6d00"), [0, 0.35, 0]);
  add(g, cyl(0.15, 0.2, 0.1, 16), mat("stripe", "#fafafa"), [0, 0.3, 0]);
  return g;
}
function obstacleBarrier() {
  const g = new THREE.Group();
  const red = mat("barrier_red", "#e53935");
  const white = mat("barrier_white", "#fafafa");
  const n = 6;
  const seg = 3.0 / n;
  for (let i = 0; i < n; i++) add(g, box(seg, 0.9, 0.4), i % 2 ? white : red, [-1.5 + seg * (i + 0.5), 0.45, 0]);
  return g;
}
function coin() {
  const g = new THREE.Group();
  add(g, cyl(0.35, 0.35, 0.08, 24), mat("gold", "#ffc107", "#ff8f00"), [0, 0, 0], [HALF, 0, 0]);
  add(g, cyl(0.22, 0.22, 0.1, 24), mat("gold_inner", "#ffe082"), [0, 0, 0], [HALF, 0, 0]);
  return g;
}

// Power-up: circa 0.8 m, centrati sull'origine
function turbo() {
  const g = new THREE.Group();
  const o = mat("turbo", "#ff6d00", "#e65100");
  for (const y of [-0.15, 0.2]) {
    add(g, box(0.5, 0.14, 0.14), o, [-0.19, y, 0], [0, 0, -0.7]);
    add(g, box(0.5, 0.14, 0.14), o, [0.19, y, 0], [0, 0, 0.7]);
  }
  return g;
}
function shield() {
  const g = new THREE.Group();
  add(g, new THREE.IcosahedronGeometry(0.4, 1), mat("shield", "#29b6f6", "#0277bd")).scale.set(1, 1, 0.5);
  add(g, new THREE.IcosahedronGeometry(0.2, 0), mat("shield_core", "#e1f5fe"));
  return g;
}
function magnet() {
  const g = new THREE.Group();
  const r = mat("magnet", "#e53935");
  const w = mat("magnet_tip", "#fafafa");
  add(g, box(0.18, 0.55, 0.18), r, [-0.25, -0.05, 0]);
  add(g, box(0.18, 0.55, 0.18), r, [0.25, -0.05, 0]);
  add(g, box(0.68, 0.18, 0.18), r, [0, -0.32, 0]);
  add(g, box(0.18, 0.12, 0.2), w, [-0.25, 0.28, 0]);
  add(g, box(0.18, 0.12, 0.2), w, [0.25, 0.28, 0]);
  return g;
}
function wide() {
  const g = new THREE.Group();
  add(g, box(0.9, 0.12, 0.45), mat("wide", "#43a047"), [0, 0, 0]);
  const a = mat("wide_arrow", "#c8e6c9", "#66bb6a");
  // frecce piramidali verso l'esterno
  add(g, cyl(0, 0.13, 0.22, 4), a, [-0.3, 0.12, 0], [0, 0, HALF]);
  add(g, cyl(0, 0.13, 0.22, 4), a, [0.3, 0.12, 0], [0, 0, -HALF]);
  return g;
}
function slowmo() {
  const g = new THREE.Group();
  const p = mat("slowmo", "#8e24aa", "#4a148c");
  add(g, cyl(0.35, 0, 0.4, 12), p, [0, 0.2, 0]);
  add(g, cyl(0, 0.35, 0.4, 12), p, [0, -0.2, 0]);
  add(g, box(0.1, 0.1, 0.1), mat("slowmo_sand", "#e1bee7"), [0, 0, 0]);
  return g;
}
function x2() {
  const g = new THREE.Group();
  add(g, box(0.4, 0.4, 0.4), mat("x2", "#fdd835", "#f9a825"), [-0.18, -0.12, 0], [0.3, 0.5, 0]);
  add(g, box(0.4, 0.4, 0.4), mat("x2_b", "#ffee58", "#f9a825"), [0.18, 0.12, 0], [0.3, 0.5, 0]);
  return g;
}

// Decorazioni sospese nel vuoto (3-15 m)
function city(i) {
  const g = new THREE.Group();
  const cols = ["#1e88e5", "#1565c0", "#42a5f5"];
  const dims = [[[3, 12, 3], [2, 6, 2]], [[2.5, 15, 2.5], [4, 4, 4]], [[3.5, 9, 3.5], [1.5, 5, 1.5]]][i];
  add(g, box(...dims[0]), mat("tower", cols[i]), [0, dims[0][1] / 2, 0]);
  add(g, box(...dims[1]), mat("tower_top", cols[(i + 1) % 3]), [0, dims[0][1] + dims[1][1] / 2, 0]);
  add(g, box(dims[0][0] + 0.1, 0.4, dims[0][2] + 0.1), mat("window", "#fff59d", "#fbc02d"), [0, dims[0][1] * 0.6, 0]);
  return g;
}
function desert(i) {
  const g = new THREE.Group();
  const sand = mat("sand", "#e0a84f");
  const green = mat("cactus", "#558b2f");
  if (i === 0) {
    add(g, cyl(0, 5, 8, 4), sand, [0, 4, 0], [0, Math.PI / 4, 0]);
  } else if (i === 1) {
    add(g, box(1.5, 7, 1.5), sand, [-3, 3.5, 0]);
    add(g, box(1.5, 7, 1.5), sand, [3, 3.5, 0]);
    add(g, box(7.5, 1.5, 1.5), sand, [0, 7.75, 0]);
  } else {
    add(g, box(1, 6, 1), green, [0, 3, 0]);
    add(g, box(2, 0.8, 0.8), green, [-1.2, 3, 0]);
    add(g, box(0.8, 2, 0.8), green, [-2, 4, 0]);
    add(g, box(2, 0.8, 0.8), green, [1.2, 2.2, 0]);
    add(g, box(0.8, 1.8, 0.8), green, [2, 3, 0]);
  }
  return g;
}
function ice(i) {
  const g = new THREE.Group();
  const c = mat("crystal", "#81d4fa", "#4fc3f7");
  const w = mat("snow", "#f5fbff");
  if (i === 0) {
    add(g, new THREE.IcosahedronGeometry(3, 0), c, [0, 3, 0]).scale.set(0.8, 1.8, 0.8);
  } else if (i === 1) {
    add(g, box(3, 3, 3), w, [0, 1.5, 0]);
    add(g, box(2, 2, 2), w, [0.5, 4, 0.3], [0, 0.5, 0]);
    add(g, box(1.2, 1.2, 1.2), w, [0, 5.7, 0], [0, 1, 0]);
  } else {
    add(g, new THREE.IcosahedronGeometry(1.5, 0), c, [-1.5, 2.5, 0]).scale.set(0.7, 1.7, 0.7);
    add(g, new THREE.IcosahedronGeometry(1.2, 0), c, [1.2, 1.8, 0.5]).scale.set(0.7, 1.5, 0.7);
    add(g, new THREE.IcosahedronGeometry(1, 0), w, [0, 0.8, -1]);
  }
  return g;
}
function neon(i) {
  const g = new THREE.Group();
  const m = mat("neon_m", "#ff00e6", "#ff00e6");
  const c = mat("neon_c", "#00e5ff", "#00e5ff");
  if (i === 0) {
    add(g, new THREE.TorusGeometry(4, 0.4, 8, 24), m, [0, 5, 0]);
    add(g, new THREE.TorusGeometry(2.5, 0.3, 8, 24), c, [0, 5, 0]);
  } else if (i === 1) {
    add(g, box(2, 8, 2), m, [0, 4, 0]);
    add(g, box(3, 1, 3), c, [0, 8.5, 0]);
  } else {
    add(g, new THREE.TorusGeometry(3, 0.35, 8, 24), c, [0, 4, 0], [HALF, 0, 0]);
    add(g, box(2.5, 2.5, 2.5), m, [0, 4, 0], [0.6, 0.6, 0]);
  }
  return g;
}

const MODELS = {
  kart_classic: kartClassic,
  kart_bolt: kartBolt,
  kart_brick: kartBrick,
  kart_rocket: kartRocket,
  wheel_basic: () => wheel(),
  wheel_sport: () => wheel({ w: 0.16, rim: "#ff1744" }),
  wheel_offroad: () => wheel({ r: 0.26, w: 0.24, tread: true }),
  wheel_retro: () => wheel({ whitewall: true }),
  rival_kart: rivalKart,
  obstacle_cone: obstacleCone,
  obstacle_barrier: obstacleBarrier,
  coin,
  powerup_turbo: turbo,
  powerup_shield: shield,
  powerup_magnet: magnet,
  powerup_wide: wide,
  powerup_slowmo: slowmo,
  powerup_x2: x2,
};
for (let i = 0; i < 3; i++) {
  MODELS[`deco_city_${i + 1}`] = () => city(i);
  MODELS[`deco_desert_${i + 1}`] = () => desert(i);
  MODELS[`deco_ice_${i + 1}`] = () => ice(i);
  MODELS[`deco_neon_${i + 1}`] = () => neon(i);
}

mkdirSync("public/models", { recursive: true });
for (const [name, build] of Object.entries(MODELS)) {
  const group = build();
  group.name = name;
  const result = await new GLTFExporter().parseAsync(group, { binary: true });
  writeFileSync(`public/models/${name}.glb`, Buffer.from(result));
  console.log(name);
}
