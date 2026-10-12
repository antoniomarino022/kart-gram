import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Steer } from "../core/sim";
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
  let target: ReturnType<typeof emitter> & { getBoundingClientRect: () => { left: number; width: number } };
  let states: Steer[];
  let detach: () => void;
  // target largo 400px a partire da x=100: metà sinistra 100..300, destra 300..500
  const down = (pointerId: number, clientX: number, button = 0, pointerType = "mouse") =>
    target.dispatch("pointerdown", { pointerId, button, pointerType, clientX });
  const up = (pointerId: number) => win.dispatch("pointerup", { pointerId });
  const key = (type: "keydown" | "keyup", code: string, repeat = false) => win.dispatch(type, { code, repeat });

  beforeEach(() => {
    win = emitter();
    target = { ...emitter(), getBoundingClientRect: () => ({ left: 100, width: 400 }) };
    states = [];
    (globalThis as unknown as { window: unknown }).window = win;
    detach = attachInput(target as unknown as HTMLElement, (s) => states.push(s));
  });
  afterEach(() => { detach(); delete (globalThis as { window?: unknown }).window; });

  it("left half steers left (+1), right half steers right (-1)", () => {
    down(1, 150); expect(states).toEqual([1]);
    up(1); expect(states).toEqual([1, 0]);
    down(2, 450, 0, "touch"); expect(states).toEqual([1, 0, -1]);
    up(2); expect(states).toEqual([1, 0, -1, 0]);
  });

  it("the most recent pointer wins and releasing it falls back to the other one", () => {
    down(1, 150, 0, "touch");
    down(2, 450, 0, "touch");
    expect(states).toEqual([1, -1]);
    up(2);
    expect(states).toEqual([1, -1, 1]);
    up(1);
    expect(states).toEqual([1, -1, 1, 0]);
  });

  it("releasing an older pointer keeps the most recent one", () => {
    down(1, 150, 0, "touch");
    down(2, 450, 0, "touch");
    up(1);
    expect(states).toEqual([1, -1]);
  });

  it("ignored right button does not release held primary", () => {
    down(1, 150);
    down(2, 450, 2); // ignorato
    up(2);
    expect(states).toEqual([1]);
    up(1);
    expect(states).toEqual([1, 0]);
  });

  it("keyboard: arrows and A/D, most recent key wins, space does nothing", () => {
    key("keydown", "Space"); expect(states).toEqual([]);
    key("keydown", "ArrowLeft"); expect(states).toEqual([1]);
    key("keydown", "KeyD"); expect(states).toEqual([1, -1]);
    key("keydown", "KeyD", true); expect(states).toEqual([1, -1]);
    key("keyup", "KeyD"); expect(states).toEqual([1, -1, 1]);
    key("keyup", "ArrowLeft"); expect(states).toEqual([1, -1, 1, 0]);
    key("keydown", "KeyA"); key("keyup", "KeyA");
    key("keydown", "ArrowRight"); key("keyup", "ArrowRight");
    expect(states.slice(4)).toEqual([1, 0, -1, 0]);
  });

  it("blur resets pointers and keys", () => {
    down(1, 150);
    key("keydown", "ArrowRight");
    win.dispatch("blur");
    expect(states).toEqual([1, -1, 0]);
    up(1);
    key("keyup", "ArrowRight");
    expect(states).toEqual([1, -1, 0]);
  });
});
