import * as THREE from "three";

/** Bioma monocromatico: cielo, nebbia, suolo, strada ed edifici sono tinte della stessa famiglia. */
export interface BiomePalette {
  name: string;
  /** Cielo in alto (il gradiente scende fino a `horizon`). */
  sky: string;
  /** Orizzonte = colore della nebbia. */
  horizon: string;
  /** Piano del suolo molto sotto la strada: più scuro e saturo di orizzonte ed edifici, così si legge come pavimento. */
  ground: string;
  road: string;
  /** Linea centrale tratteggiata. */
  roadLine: string;
  /** Strisce chiare ai bordi. */
  roadEdge: string;
  /** Tinte degli edifici, dalla più chiara alla più scura. */
  buildings: [string, string, string];
  /** Tinta della luce emisferica (cielo). */
  light: string;
  /** Moltiplicatore dell'intensità delle luci. */
  intensity: number;
  /** Pedane boost: tinta chiara e luminosa del bioma (le frecce ne sono una versione più satura). */
  boost: string;
}

export const BIOMES: BiomePalette[] = [
  {
    name: "Sky City", sky: "#3f93e0", horizon: "#a6dcf7", ground: "#173f85",
    road: "#2b5cc4", roadLine: "#8db4f5", roadEdge: "#6f9de6",
    buildings: ["#8fc6f0", "#6aa6e6", "#4f88d6"], light: "#e6f4ff", intensity: 1, boost: "#8fe3ff",
  },
  {
    name: "Desert Void", sky: "#e58a4c", horizon: "#fad3a0", ground: "#c2581f",
    road: "#9c4f2b", roadLine: "#eba57a", roadEdge: "#cf8458",
    buildings: ["#f4c38e", "#e6a16b", "#d1834f"], light: "#fff0dc", intensity: 1, boost: "#ffd9a0",
  },
  {
    name: "Ice", sky: "#7fc0ea", horizon: "#eaf7ff", ground: "#2a6fae",
    road: "#5b98c6", roadLine: "#dff2ff", roadEdge: "#a6d2f0",
    buildings: ["#e2f3fd", "#c2e2f7", "#9fcbec"], light: "#ffffff", intensity: 1, boost: "#e6fbff",
  },
  {
    name: "Neon Night", sky: "#0c0420", horizon: "#3d1774", ground: "#0f0526",
    road: "#1d0b40", roadLine: "#ff4fd8", roadEdge: "#3fd8ff",
    buildings: ["#5a2aa6", "#46208a", "#34176d"], light: "#c9a8ff", intensity: 0.85, boost: "#ff9cf0",
  },
];

export const biomeAt = (index: number) => BIOMES[((index % BIOMES.length) + BIOMES.length) % BIOMES.length];

/** Colori correnti della scena, interpolati verso il bioma di destinazione. */
export class SceneColors {
  readonly sky = new THREE.Color();
  readonly horizon = new THREE.Color();
  readonly ground = new THREE.Color();
  readonly light = new THREE.Color();
  intensity = 1;
  private tmp = new THREE.Color();

  constructor(pal: BiomePalette) { this.lerpTo(pal, 1); }

  lerpTo(pal: BiomePalette, t: number) {
    this.sky.lerp(this.tmp.set(pal.sky), t);
    this.horizon.lerp(this.tmp.set(pal.horizon), t);
    this.ground.lerp(this.tmp.set(pal.ground), t);
    this.light.lerp(this.tmp.set(pal.light), t);
    this.intensity += (pal.intensity - this.intensity) * t;
  }
}
