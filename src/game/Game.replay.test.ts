import { describe, expect, it } from "vitest";
import { mulberry32 } from "./core/rng";
import { createGame, finalScore, revive, simulate, step, type Steer } from "./core/sim";
import { InputRecorder } from "./inputRecorder";

// Riproduce il loop del Game senza three: stessa regola di registrazione (InputRecorder) prima di ogni step.
function play(seed: number, maxTicks: number, withRevive: boolean) {
  const st = createGame(seed);
  const rec = new InputRecorder();
  const rng = mulberry32(1);
  let steer: Steer = 0;
  while (st.tick < maxTicks) {
    // mulberry32(1) decide a ogni tick se cambiare input, e verso quale sterzata
    if (rng() < 0.06) steer = ([-1, 0, 1] as const)[Math.floor(rng() * 3)];
    rec.record(st.tick, steer);
    step(st, steer);
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
    rec.record(0, 0);
    rec.record(1, 1);
    rec.record(2, 1);
    rec.record(3, -1);
    rec.record(5, 0);
    expect(rec.inputs).toEqual([[1, 1], [3, -1], [5, 0]]);
  });
});
