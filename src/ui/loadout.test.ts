import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG, DEFAULT_EQUIPPED } from "@/lib/constants";
import { buildLoadout } from "./loadout";

describe("buildLoadout", () => {
  it("maps equipped items to models, paint and trail", () => {
    const l = buildLoadout({ kart: "kart_bolt", paint: "paint_metal", wheels: "wheel_sport", trail: "trail_fire" }, DEFAULT_CATALOG);
    expect(l).toEqual({
      kartModel: "kart_bolt.glb", wheelModel: "wheel_sport.glb",
      paint: { color: "#b8c4cc", finish: "metal" }, trailColor: "#ff6b1a", trailId: "trail_fire",
    });
  });

  it("falls back to defaults for unknown or mismatched ids", () => {
    const l = buildLoadout({ ...DEFAULT_EQUIPPED, kart: "nope", paint: "trail_fire" }, DEFAULT_CATALOG);
    expect(l.kartModel).toBe("kart_classic.glb");
    expect(l.paint).toEqual({ color: "#e63946", finish: "flat" });
  });
});
