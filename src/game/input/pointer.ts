export function attachInput(target: HTMLElement, onChange: (pressed: boolean) => void) {
  const pointers = new Set<number>();
  let key = false, last = false;
  const emit = () => { const p = pointers.size > 0 || key; if (p !== last) { last = p; onChange(p); } };
  const down = (e: PointerEvent) => { if (e.pointerType === "mouse" && e.button !== 0) return; e.preventDefault(); pointers.add(e.pointerId); emit(); };
  const up = (e: PointerEvent) => { if (pointers.delete(e.pointerId)) emit(); };
  const kd = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); key = true; emit(); } };
  const ku = (e: KeyboardEvent) => { if (e.code === "Space") { key = false; emit(); } };
  const reset = () => { pointers.clear(); key = false; emit(); };
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
