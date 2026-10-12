import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_MODEL_NAMES } from "./models";
import { BIOMES } from "./palette";

describe("ALL_MODEL_NAMES", () => {
  it("corrisponde esattamente ai file in public/models", () => {
    const files = readdirSync("public/models").filter((f) => f.endsWith(".glb")).map((f) => f.slice(0, -4));
    expect([...ALL_MODEL_NAMES].sort()).toEqual(files.sort());
  });

  it("le decorazioni dei biomi esistono", () => {
    for (const b of BIOMES) for (const d of b.deco) expect(ALL_MODEL_NAMES).toContain(d);
  });
});
