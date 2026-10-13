import { describe, expect, it } from "vitest";
import { UI_PALETTES, uiPalette, uiVars } from "./uiPalette";

type Rgb = [number, number, number];

function parse(c: string): { rgb: Rgb; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(c);
  if (!m) throw new Error(`colore non valido: ${c}`);
  return { rgb: [+m[1], +m[2], +m[3]], a: +m[4] };
}

/** Colore traslucido composto sopra uno sfondo opaco. */
const over = (c: string, bg: Rgb): Rgb => {
  const { rgb, a } = parse(c);
  return rgb.map((v, i) => v * a + bg[i] * (1 - a)) as Rgb;
};

function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const WHITE: Rgb = [255, 255, 255];

describe("uiPalette", () => {
  it("cicla sui 4 biomi", () => {
    expect(UI_PALETTES).toHaveLength(4);
    expect(uiPalette(0)).toBe(UI_PALETTES[0]);
    expect(uiPalette(3)).toBe(UI_PALETTES[3]);
    expect(uiPalette(4)).toBe(UI_PALETTES[0]);
    expect(uiPalette(9)).toBe(UI_PALETTES[1]);
    expect(uiPalette(-1)).toBe(UI_PALETTES[3]);
    expect(uiPalette(Number.NaN)).toBe(UI_PALETTES[0]);
  });

  it("Sky City usa il giallo del riferimento", () => {
    expect(uiPalette(0).primary).toBe("#ffd60a");
  });

  it("espone le variabili CSS", () => {
    expect(Object.keys(uiVars(uiPalette(1)))).toEqual(
      expect.arrayContaining(["--ui-surface", "--ui-primary", "--ui-primary-text", "--ui-accent-text"]),
    );
  });

  // caso peggiore: superficie traslucida sopra un cielo bianco (Ice, Desert)
  it.each(UI_PALETTES.map((p, i) => [i, p] as const))("contrasto WCAG AA, bioma %i", (_, p) => {
    const surface = over(p.surface, WHITE);
    expect(contrast(WHITE, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parse(p.accentText).rgb, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parse(p.primaryText).rgb, parse(p.primary).rgb)).toBeGreaterThanOrEqual(4.5);
  });
});
