import type { Steer } from "./core/sim";

/**
 * Registra i cambi di input come li legge `simulate`: prima di ogni `step`, se la sterzata è cambiata
 * rispetto all'ultimo valore registrato, aggiunge `[state.tick, steer]` (tick PRIMA dello step).
 * Puro (niente three/DOM): usato dal Game e dal test di replay.
 */
export class InputRecorder {
  readonly inputs: [number, Steer][] = [];
  private last: Steer = 0;

  record(tick: number, steer: Steer) {
    if (steer !== this.last) {
      this.inputs.push([tick, steer]);
      this.last = steer;
    }
  }
}
