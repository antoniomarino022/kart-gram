import type { Steer } from "../core/sim";

const KEYS: Record<string, -1 | 1> = { ArrowLeft: 1, KeyA: 1, ArrowRight: -1, KeyD: -1 };

/**
 * Touch, mouse e tastiera → sterzata. Metà sinistra del target = +1 (sinistra), metà destra = -1.
 * Vince l'ultimo dito/tasto premuto; rilasciandolo si torna a quello ancora premuto prima.
 */
export function attachInput(target: HTMLElement, onChange: (steer: Steer) => void) {
  // in ordine di pressione: l'ultimo è quello attivo
  const held: { id: string; side: -1 | 1 }[] = [];
  let last: Steer = 0;
  const emit = () => {
    const s = held.length ? held[held.length - 1].side : 0;
    if (s !== last) { last = s; onChange(s); }
  };
  const press = (id: string, side: -1 | 1) => { release(id, false); held.push({ id, side }); emit(); };
  const release = (id: string, notify = true) => {
    const i = held.findIndex((h) => h.id === id);
    if (i >= 0) held.splice(i, 1);
    if (notify && i >= 0) emit();
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const r = target.getBoundingClientRect();
    press(`p${e.pointerId}`, e.clientX < r.left + r.width / 2 ? 1 : -1);
  };
  const up = (e: PointerEvent) => release(`p${e.pointerId}`);
  const kd = (e: KeyboardEvent) => {
    const side = KEYS[e.code];
    if (!side) return;
    e.preventDefault();
    if (!e.repeat) press(e.code, side);
  };
  const ku = (e: KeyboardEvent) => release(e.code);
  const reset = () => { held.length = 0; emit(); };
  const ctx = (e: Event) => e.preventDefault();
  target.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  window.addEventListener("blur", reset);
  target.addEventListener("contextmenu", ctx);
  return () => {
    target.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    window.removeEventListener("blur", reset);
    target.removeEventListener("contextmenu", ctx);
  };
}
