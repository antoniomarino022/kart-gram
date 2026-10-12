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
      className="animate-toast pointer-events-none fixed left-1/2 z-50 max-w-[90vw] rounded-2xl border-2 border-[#1b1035] bg-[#1b1035]/90 px-5 py-3 text-center font-bold text-white shadow-lg"
      style={{ bottom: "calc(max(1rem, var(--safe-bottom)) + 1rem)" }}
    >
      {toast.text}
    </div>
  );
}
