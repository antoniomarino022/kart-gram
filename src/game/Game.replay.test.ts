import { describe, expect, it } from "vitest";
import { mulberry32 } from "./core/rng";
import { createGame, finalScore, revive, simulate, step } from "./core/sim";
import { InputRecorder } from "./inputRecorder";

// Riproduce il loop del Game senza three: stessa regola di registrazione (InputRecorder) prima di ogni step.
function play(seed: number, maxTicks: number, withRevive: boolean) {
  const st = createGame(seed);
  const rec = new InputRecorder();
  const rng = mulberry32(1);
  let pressed = false;
  while (st.tick < maxTicks) {
    if (rng() < 0.06) pressed = !pressed; // mulberry32(1) decide a ogni tick se cambiare input
    rec.record(st.tick, pressed);
    step(st, pressed);
    if (st.phase === "over") {
      if (withRevive && !st.revived) revive(st);
      else break;
    }
  }
  return { st, inputs: rec.inputs };
}

describe("Game replay", () => {
  for (const withRevive of [false, true]) {
    it(`gli input registrati riproducono lo stesso score${withRevive ? " (con revive)" : ""}`, () => {
      const maxTicks = 4000;
      const { st, inputs } = play(42, maxTicks, withRevive);
      expect(st.tick).toBeGreaterThan(withRevive ? 150 : 60);
      expect(inputs.length).toBeGreaterThan(2);
      const replay = simulate(42, inputs, { maxTicks, revived: withRevive });
      expect(replay.tick).toBe(st.tick);
      expect(replay.coins).toBe(st.coins);
      expect(replay.revived).toBe(st.revived);
      expect(finalScore(replay)).toBe(finalScore(st));
    });
  }

  it("registra solo i cambi, con il tick prima dello step", () => {
    const rec = new InputRecorder();
    rec.record(0, false);
    rec.record(1, true);
    rec.record(2, true);
    rec.record(5, false);
    expect(rec.inputs).toEqual([[1, true], [5, false]]);
  });
});
