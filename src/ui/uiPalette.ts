/**
 * Colori della UI per bioma (0 Sky City, 1 Desert Void, 2 Ice, 3 Neon Night; poi si ricomincia).
 * Applicati come variabili CSS sulla radice dell'app; la transizione la fa il CSS (@property in globals.css).
 */
export interface UiPalette {
  /** Superficie traslucida scura (box, bottoni secondari, card): tinta scura del bioma. */
  surface: string;
  /** Velo a tutto schermo dietro alle schermate (più leggero della superficie). */
  scrim: string;
  /** Accento brillante: azione principale e valori evidenziati. */
  primary: string;
  /** Testo sopra il colore primario. */
  primaryText: string;
  /** Valori evidenziati sopra la superficie (monete, best, combo). */
  accentText: string;
}

export const UI_PALETTES: readonly UiPalette[] = [
  // Sky City: giallo del riferimento su navy
  { surface: "rgba(16, 32, 80, 0.72)", scrim: "rgba(10, 22, 58, 0.45)", primary: "#ffd60a", primaryText: "#101d45", accentText: "#ffd60a" },
  // Desert Void: arancio su marrone caldo
  { surface: "rgba(54, 22, 4, 0.8)", scrim: "rgba(48, 20, 6, 0.45)", primary: "#ff8c1a", primaryText: "#2a1200", accentText: "#ffc670" },
  // Ice: ciano su blu freddo
  { surface: "rgba(8, 42, 70, 0.76)", scrim: "rgba(6, 30, 52, 0.45)", primary: "#3fd8ff", primaryText: "#05243a", accentText: "#7fe6ff" },
  // Neon Night: fucsia su viola profondo
  { surface: "rgba(38, 8, 66, 0.8)", scrim: "rgba(26, 6, 48, 0.5)", primary: "#ff3fb4", primaryText: "#22042e", accentText: "#ffa8e2" },
];

export function uiPalette(biome: number): UiPalette {
  const n = UI_PALETTES.length;
  const i = Math.floor(biome) || 0;
  return UI_PALETTES[((i % n) + n) % n];
}

/** Variabili CSS da mettere nello style della radice. */
export function uiVars(p: UiPalette): Record<string, string> {
  return {
    "--ui-surface": p.surface,
    "--ui-scrim": p.scrim,
    "--ui-primary": p.primary,
    "--ui-primary-text": p.primaryText,
    "--ui-accent-text": p.accentText,
  };
}
