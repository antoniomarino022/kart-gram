import { describe, expect, it } from "vitest";
import { mulberry32, pick, range } from "./rng";

describe("mulberry32", () => {
  it("same seed gives same sequence", () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("different seeds differ", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it("values in [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it("range and pick", () => {
    const r = mulberry32(3);
    for (let i = 0; i < 100; i++) { const v = range(r, 5, 10); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThan(10); }
    expect(["a", "b"]).toContain(pick(r, ["a", "b"] as const));
  });
});
