import * as THREE from "three";
import { CONFIG, STEP } from "../core/config";
import { sampleAt, type Track } from "../core/track";
import type { ModelLibrary } from "./models";
import { biomeAt } from "./palette";

const COUNT = 40;
const BEHIND = 20;
const AHEAD = 300;
/** I nuovi oggetti nascono in fondo, in [kartS + RESPAWN_FROM, kartS + AHEAD]. */
const RESPAWN_FROM = 240;
const MIN_DIST = 15, MAX_DIST = 80;
const MIN_Y = -20, MAX_Y = 30;
/** Distanza orizzontale minima da qualunque tratto di strada vicino. */
const CLEARANCE = 14;
const MAX_HEIGHT = 16;

interface Slot { obj: THREE.Object3D | null; name: string; s: number; spin: number; phase: number; baseY: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Oggetti decorativi sospesi nel vuoto ai lati della strada (solo grafica: usa Math.random). */
export class Decorations {
  private slots: Slot[] = [];

  constructor(private scene: THREE.Scene, private models: ModelLibrary) {}

  update(track: Track, kartS: number, frameDt: number, time: number) {
    if (this.slots.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        const slot: Slot = { obj: null, name: "", s: 0, spin: 0, phase: 0, baseY: 0 };
        this.place(slot, track, kartS - BEHIND + ((AHEAD + BEHIND) * (i + Math.random())) / COUNT);
        this.slots.push(slot);
      }
    }
    for (const slot of this.slots) {
      if (slot.s < kartS - BEHIND) this.place(slot, track, kartS + rand(RESPAWN_FROM, AHEAD));
      const o = slot.obj!;
      o.rotation.y += slot.spin * frameDt;
      o.position.y = slot.baseY + Math.sin(time * 0.5 + slot.phase) * 0.6;
    }
  }

  private place(slot: Slot, track: Track, s: number) {
    const biome = Math.floor(Math.max(0, s) / CONFIG.biomeLength);
    const names = biomeAt(biome).deco;
    const name = names[Math.floor(Math.random() * names.length)];
    if (slot.name !== name) {
      if (slot.obj) this.scene.remove(slot.obj);
      slot.obj = this.models.get(name);
      slot.name = name;
      this.scene.add(slot.obj);
    }
    const o = slot.obj!;
    const scale = rand(0.8, 1.6);
    const p = sampleAt(track, s);
    let x = 0, z = 0, y = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const lateral = side * (attempt === 7 ? MAX_DIST : rand(MIN_DIST, MAX_DIST));
      x = p.x - Math.sin(p.angle) * lateral;
      z = p.y + Math.cos(p.angle) * lateral; // ancora in coordinate core (y)
      y = p.elevation + rand(MIN_Y, MAX_Y);
      if (clear(track, s, x, z, y, MAX_HEIGHT * scale)) break;
    }
    slot.s = s;
    slot.spin = rand(0.05, 0.25) * (Math.random() < 0.5 ? -1 : 1);
    slot.phase = rand(0, Math.PI * 2);
    slot.baseY = y;
    o.position.set(x, y, -z);
    o.rotation.set(rand(-0.35, 0.35), rand(0, Math.PI * 2), rand(-0.35, 0.35));
    o.scale.setScalar(scale);
  }

  dispose() {
    for (const slot of this.slots) if (slot.obj) this.scene.remove(slot.obj);
    this.slots = [];
  }
}

/** true se l'oggetto (base y, alto h) non invade la strada nei dintorni di s. */
function clear(track: Track, s: number, x: number, y: number, baseY: number, h: number) {
  const S = track.samples;
  const from = Math.max(0, Math.floor((s - 120) / STEP));
  const to = Math.min(S.length - 1, Math.ceil((s + 120) / STEP));
  for (let i = from; i <= to; i += 3) {
    const q = S[i];
    if ((q.x - x) ** 2 + (q.y - y) ** 2 > CLEARANCE * CLEARANCE) continue;
    // sopra la strada con margine per la camera, oppure tutto sotto la lastra
    if (baseY > q.elevation + 10 || baseY + h < q.elevation - 3) continue;
    return false;
  }
  return true;
}
