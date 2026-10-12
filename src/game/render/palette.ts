export interface BiomePalette {
  name: string;
  sky: string;
  fog: string;
  road: string;
  roadEdge: string;
  stripe: string;
  /** Nomi dei modelli decorativi sospesi nel vuoto. */
  deco: string[];
  /** Moltiplicatore dell'intensità delle luci. */
  light: number;
}

export const BIOMES: BiomePalette[] = [
  {
    name: "Sky City", sky: "#5ab4e6", fog: "#8fcff0", road: "#2f5fd0", roadEdge: "#ffd23f", stripe: "#ffffff",
    deco: ["deco_city_1", "deco_city_2", "deco_city_3"], light: 1,
  },
  {
    name: "Desert Void", sky: "#f4b56a", fog: "#f8cf98", road: "#a0522d", roadEdge: "#fff1c9", stripe: "#ffffff",
    deco: ["deco_desert_1", "deco_desert_2", "deco_desert_3"], light: 1.05,
  },
  {
    name: "Ice", sky: "#cfe9ff", fog: "#e4f3ff", road: "#7fb3d5", roadEdge: "#1f4e8c", stripe: "#ffffff",
    deco: ["deco_ice_1", "deco_ice_2", "deco_ice_3"], light: 1,
  },
  {
    name: "Neon Night", sky: "#14082b", fog: "#24104a", road: "#2b1055", roadEdge: "#ff2bd6", stripe: "#ffffff",
    deco: ["deco_neon_1", "deco_neon_2", "deco_neon_3"], light: 0.75,
  },
];

export const biomeAt = (index: number) => BIOMES[((index % BIOMES.length) + BIOMES.length) % BIOMES.length];
