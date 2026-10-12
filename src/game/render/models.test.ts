import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_MODEL_NAMES } from "./models";

describe("ALL_MODEL_NAMES", () => {
  it("corrisponde esattamente ai file in public/models", () => {
    const files = readdirSync("public/models").filter((f) => f.endsWith(".glb")).map((f) => f.slice(0, -4));
    expect([...ALL_MODEL_NAMES].sort()).toEqual(files.sort());
  });
});
