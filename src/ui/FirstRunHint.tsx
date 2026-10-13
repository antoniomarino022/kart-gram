"use client";

import { useEffect, useState } from "react";

const KEY = "kartgram.hintSeen";

function seen() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** Alla prima partita: le due metà dello schermo con "◀ SINISTRA" / "DESTRA ▶" per ~3 s, poi svaniscono. */
export function FirstRunHint() {
  const [show, setShow] = useState(() => !seen());

  useEffect(() => {
    if (!show) return;
    try { localStorage.setItem(KEY, "1"); } catch { /* storage non disponibile: lo si rivedrà alla prossima partita */ }
  }, [show]);

  if (!show) return null;
  return (
    <div className="animate-hint pointer-events-none absolute inset-0 flex" onAnimationEnd={() => setShow(false)} aria-hidden>
      <div className="flex flex-1 items-center justify-center bg-white/10">
        <span className="box px-3 py-1.5 text-2xl font-black text-ui-accent">◀ SINISTRA</span>
      </div>
      <div className="w-0.5 bg-white/40" />
      <div className="flex flex-1 items-center justify-center bg-white/10">
        <span className="box px-3 py-1.5 text-2xl font-black text-ui-accent">DESTRA ▶</span>
      </div>
    </div>
  );
}
