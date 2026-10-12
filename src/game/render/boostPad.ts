import * as THREE from "three";
import { CONFIG } from "../core/config";
import type { Item } from "../core/items";
import { sampleAt, type Track } from "../core/track";
import { biomeAt } from "./palette";

/** Quota sopra la strada (m). */
const LIFT = 0.015;
/** Passo delle frecce (m) e velocità di scorrimento (m/s). */
const PERIOD = 2.4, SCROLL = 5;
/** Quanto le braccia della freccia arretrano per metro di distanza dal centro. */
const SWEEP = 0.75;

const VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aHalf;
attribute vec3 aBase;
attribute vec3 aArrow;
varying vec2 vUv;
varying float vHalf;
varying vec3 vBase;
varying vec3 vArrow;
void main() {
  vUv = uv;
  vHalf = aHalf;
  vBase = aBase;
  vArrow = aArrow;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// uv.x: -1..1 di traverso alla pedana, uv.y: metri dall'inizio. Frecce "^" con la punta in avanti che scorrono in avanti.
const FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uLength;
varying vec2 vUv;
varying float vHalf;
varying vec3 vBase;
varying vec3 vArrow;
void main() {
  float xm = abs(vUv.x) * vHalf;
  float c = (vUv.y + xm * ${SWEEP.toFixed(2)}) / ${PERIOD.toFixed(2)} - uTime * ${(SCROLL / PERIOD).toFixed(3)};
  float f = fract(c);
  float arrow = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.34, 0.42, f));
  arrow *= 1.0 - smoothstep(0.62, 0.78, abs(vUv.x));
  float edgeX = 1.0 - smoothstep(0.86, 1.0, abs(vUv.x));
  float edgeY = smoothstep(0.0, 0.9, vUv.y) * (1.0 - smoothstep(uLength - 0.9, uLength, vUv.y));
  vec3 col = mix(vBase, vArrow, arrow) * 1.08;
  gl_FragColor = vec4(col, 0.94 * edgeX * edgeY);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function createBoostMaterial() {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uLength: { value: CONFIG.boost.length } }]),
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  m.polygonOffset = true;
  m.polygonOffsetFactor = -3;
  m.polygonOffsetUnits = -3;
  return m;
}

const base = new THREE.Color(), arrow = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };

/** Striscia sulla strada che segue la curvatura: tutta la larghezza (lateral 0) o la metà indicata dal segno di lateral. */
export function boostGeometry(track: Track, it: Item) {
  // tinta chiara del bioma della pedana; le frecce sono la stessa tinta, più satura e profonda
  base.set(biomeAt(Math.floor(it.s / CONFIG.biomeLength)).boost);
  base.getHSL(hsl);
  arrow.setHSL(hsl.h, Math.min(1, hsl.s + 0.3), Math.max(0, hsl.l - 0.2));

  const pos: number[] = [], uv: number[] = [], half: number[] = [], cb: number[] = [], ca: number[] = [];
  const index: number[] = [];
  const n = Math.max(1, Math.ceil(it.length));
  const side = Math.sign(it.lateral);
  for (let i = 0; i <= n; i++) {
    const along = (it.length * i) / n;
    const p = sampleAt(track, it.s + along);
    const w = p.width / 2;
    // laterali dei due bordi (sinistra > 0); a runtime la larghezza è quella corrente della strada
    const [a, b] = side === 0 ? [-w, w] : side > 0 ? [0, w] : [-w, 0];
    const sx = -Math.sin(p.angle), sy = Math.cos(p.angle);
    const y = p.elevation + LIFT;
    pos.push(p.x + sx * a, y, -(p.y + sy * a), p.x + sx * b, y, -(p.y + sy * b));
    uv.push(-1, along, 1, along);
    const hw = (b - a) / 2;
    half.push(hw, hw);
    cb.push(base.r, base.g, base.b, base.r, base.g, base.b);
    ca.push(arrow.r, arrow.g, arrow.b, arrow.r, arrow.g, arrow.b);
    if (i > 0) {
      const v = (i - 1) * 2;
      index.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); // antiorario visto dall'alto: faccia verso il cielo
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aHalf", new THREE.Float32BufferAttribute(half, 1));
  g.setAttribute("aBase", new THREE.Float32BufferAttribute(cb, 3));
  g.setAttribute("aArrow", new THREE.Float32BufferAttribute(ca, 3));
  g.setIndex(index);
  return g;
}
