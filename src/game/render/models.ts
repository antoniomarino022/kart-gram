import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Tutti i modelli in public/models (senza estensione). */
export const ALL_MODEL_NAMES: string[] = [
  "kart_classic", "kart_bolt", "kart_brick", "kart_rocket",
  "wheel_basic", "wheel_sport", "wheel_offroad", "wheel_retro",
  "rival_kart", "obstacle_cone", "obstacle_barrier", "obstacle_barrel", "coin",
  "powerup_turbo", "powerup_shield", "powerup_magnet", "powerup_wide", "powerup_slowmo", "powerup_x2", "powerup_heart",
  "powerup_ghost", "powerup_shockwave",
  "deco_city_1", "deco_city_2", "deco_city_3",
  "deco_desert_1", "deco_desert_2", "deco_desert_3",
  "deco_ice_1", "deco_ice_2", "deco_ice_3",
  "deco_neon_1", "deco_neon_2", "deco_neon_3",
];

export interface ModelLibrary {
  /** Clone profondo del modello (geometrie e materiali condivisi: non vanno distrutti dal chiamante). */
  get(name: string): THREE.Object3D;
}

/** "kart_bolt.glb" e "kart_bolt" indicano lo stesso modello. */
const baseName = (name: string) => name.replace(/\.glb$/i, "");

// Forma di ripiego: [larghezza, altezza, profondità, y del centro, colore]
type FallbackSpec = [number, number, number, number, string];
export const POWERUP_COLORS: Record<string, string> = {
  turbo: "#ff6d00", shield: "#29b6f6", magnet: "#e53935", wide: "#43a047", slowmo: "#8e24aa", x2: "#fdd835", heart: "#e53950",
  ghost: "#e0e7ff", shockwave: "#00e5ff",
};

function fallbackSpec(name: string): FallbackSpec {
  if (name.startsWith("kart_")) return [1, 0.45, 1.6, 0.375, "#e63946"];
  if (name.startsWith("wheel_")) return [0.18, 0.44, 0.44, 0, "#1c1c22"];
  if (name === "rival_kart") return [1, 0.6, 1.6, 0.3, "#6d7278"];
  if (name === "obstacle_cone") return [0.6, 0.7, 0.6, 0.35, "#ff6d00"];
  if (name === "obstacle_barrel") return [0.7, 1.0, 0.7, 0.5, "#d97706"];
  if (name === "obstacle_barrier") return [3, 0.9, 0.4, 0.45, "#e53935"];
  if (name === "coin") return [0.7, 0.7, 0.08, 0, "#ffc107"];
  if (name.startsWith("powerup_")) return [0.7, 0.7, 0.7, 0, POWERUP_COLORS[name.slice(8)] ?? "#ff00ff"];
  if (name.startsWith("deco_")) return [4, 10, 4, 5, "#90a4ae"];
  return [1, 1, 1, 0.5, "#ff00ff"];
}

function makeFallback(name: string): THREE.Object3D {
  const [w, h, d, y, color] = fallbackSpec(name);
  // nei kart il materiale si chiama "paint" così la vernice funziona anche sul ripiego
  const mat = new THREE.MeshStandardMaterial({ color, name: name.startsWith("kart_") ? "paint" : "fallback", flatShading: true });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.y = y;
  const g = new THREE.Group();
  g.name = name;
  g.add(mesh);
  return g;
}

export async function loadModels(names: string[]): Promise<ModelLibrary> {
  const loader = new GLTFLoader();
  const loaded = new Map<string, THREE.Object3D>();
  const fallbacks = new Map<string, THREE.Object3D>();
  const warned = new Set<string>();

  await Promise.all(
    names.map(async (n) => {
      const name = baseName(n);
      try {
        const gltf = await loader.loadAsync(`/models/${name}.glb`);
        loaded.set(name, gltf.scene);
      } catch (err) {
        warned.add(name);
        console.warn(`[models] impossibile caricare "${name}", uso una forma di ripiego`, err);
      }
    }),
  );

  return {
    get(n: string) {
      const name = baseName(n);
      const model = loaded.get(name);
      if (model) return model.clone(true);
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(`[models] modello "${name}" non caricato, uso una forma di ripiego`);
      }
      let fb = fallbacks.get(name);
      if (!fb) { fb = makeFallback(name); fallbacks.set(name, fb); }
      return fb.clone(true);
    },
  };
}
