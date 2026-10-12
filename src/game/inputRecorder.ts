/**
 * Registra i cambi di input come li legge `simulate`: prima di ogni `step`, se `pressed` è cambiato
 * rispetto all'ultimo valore registrato, aggiunge `[state.tick, pressed]` (tick PRIMA dello step).
 * Puro (niente three/DOM): usato dal Game e dal test di replay.
 */
export class InputRecorder {
  readonly inputs: [number, boolean][] = [];
  private last = false;

  record(tick: number, pressed: boolean) {
    if (pressed !== this.last) {
      this.inputs.push([tick, pressed]);
      this.last = pressed;
    }
  }
}
