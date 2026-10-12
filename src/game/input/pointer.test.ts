import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachInput } from "./pointer";

type Handler = (e: unknown) => void;
function emitter() {
  const m = new Map<string, Set<Handler>>();
  return {
    addEventListener: (t: string, h: Handler) => { (m.get(t) ?? m.set(t, new Set()).get(t)!).add(h); },
    removeEventListener: (t: string, h: Handler) => { m.get(t)?.delete(h); },
    dispatch: (t: string, e: object = {}) => m.get(t)?.forEach((h) => h({ preventDefault() {}, ...e })),
  };
}

describe("attachInput", () => {
  let win: ReturnType<typeof emitter>;
  let target: ReturnType<typeof emitter>;
  let states: boolean[];
  let detach: () => void;
  const down = (pointerId: number, button = 0) => target.dispatch("pointerdown", { pointerId, button, pointerType: "mouse" });
  const up = (pointerId: number) => win.dispatch("pointerup", { pointerId });

  beforeEach(() => {
    win = emitter(); target = emitter(); states = [];
    (globalThis as unknown as { window: unknown }).window = win;
    detach = attachInput(target as unknown as HTMLElement, (p) => states.push(p));
  });
  afterEach(() => { detach(); delete (globalThis as { window?: unknown }).window; });

  it("primary down/up toggles", () => {
    down(1); expect(states).toEqual([true]);
    up(1); expect(states).toEqual([true, false]);
  });

  it("ignored right button does not release held primary", () => {
    down(1);
    down(2, 2); // ignorato
    up(2);
    expect(states).toEqual([true]);
    up(1);
    expect(states).toEqual([true, false]);
  });

  it("blur resets", () => {
    down(1);
    win.dispatch("blur");
    expect(states).toEqual([true, false]);
  });
});
