"use client";

import { useCallback, useEffect, useState } from "react";

export interface ToastMsg { id: number; text: string }

let nextId = 1;

/** Un toast alla volta: un nuovo messaggio sostituisce il precedente. */
export function useToast() {
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const show = useCallback((text: string) => setToast({ id: nextId++, text }), []);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}

export function Toast({ toast, onDone }: { toast: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="ui-root box animate-toast pointer-events-none fixed left-1/2 z-50 max-w-[90vw] px-4 py-2.5 text-center text-lg font-extrabold"
      // in alto, sotto HUD e intestazioni: così non copre mai i bottoni in basso (es. game over)
      style={{ top: "calc(max(0.75rem, var(--safe-top)) + 6.5rem)" }}
    >
      {toast.text}
    </div>
  );
}
