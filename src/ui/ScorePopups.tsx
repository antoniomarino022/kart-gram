"use client";

import { useEffect, useState } from "react";

export type PopupKind = "drift" | "nearMiss" | "boost";
type Listener = (kind: PopupKind, points: number) => void;

/** Canale dagli eventi del Game ai popup "+N": solo eventi, niente polling. */
export function createPopupBus() {
  const listeners = new Set<Listener>();
  return {
    push(kind: PopupKind, points: number) { for (const l of listeners) l(kind, points); },
    subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
export type PopupBus = ReturnType<typeof createPopupBus>;

interface Popup { id: number; kind: PopupKind; points: number }

/**
 * Punti fluttuanti sopra il kart: salgono e svaniscono (animazione CSS), poi si rimuovono.
 * Un solo popup alla volta: mentre è visibile, un evento dello stesso tipo somma i punti senza
 * riavviare l'animazione; uno di tipo diverso viene ignorato.
 */
export function ScorePopups({ bus }: { bus: PopupBus }) {
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    let id = 0;
    return bus.subscribe((kind, points) => setPopup((cur) => {
      if (!cur) return { id: ++id, kind, points };
      return cur.kind === kind ? { ...cur, points: cur.points + points } : cur;
    }));
  }, [bus]);

  if (!popup) return null;
  const n = Math.round(popup.points);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[46%] z-10 flex justify-center" aria-live="polite">
      <div
        key={popup.id}
        onAnimationEnd={() => setPopup((cur) => (cur?.id === popup.id ? null : cur))}
        // box scuro traslucido: il testo resta leggibile anche sui cieli chiari (Ice, Desert)
        className="box animate-score-popup absolute px-3 py-1 text-4xl leading-none font-black whitespace-nowrap"
      >
        {popup.kind === "drift" ? (
          <span className="text-ui-accent">+{n}</span>
        ) : popup.kind === "nearMiss" ? (
          <>Near miss <span className="text-ui-accent">+{n}</span></>
        ) : (
          <span className="text-ui-accent">Boost!</span>
        )}
      </div>
    </div>
  );
}
