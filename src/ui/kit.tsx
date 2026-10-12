import type { ReactNode } from "react";
import { fmt } from "./loadout";

export function CoinBadge({ coins, className = "" }: { coins: number; className?: string }) {
  return (
    <div className={`panel flex items-center gap-1.5 rounded-full px-3 py-1.5 text-lg font-black italic text-outline-sm ${className}`}>
      <span aria-hidden>🪙</span>
      <span aria-label={`${fmt(coins)} monete`}>{fmt(coins)}</span>
    </div>
  );
}

/** Schermata a tutto schermo sopra il canvas: barra con "indietro", titolo e monete; contenuto scrollabile. */
export function Screen({ title, coins, onBack, children }: { title: string; coins?: number; onBack: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#1b1035]/70 via-[#1b1035]/45 to-[#1b1035]/75">
      <header className="pt-safe flex shrink-0 items-center gap-3 px-4 pb-3">
        <button type="button" onClick={onBack} className="btn btn-white h-11 w-11 shrink-0 px-0 text-2xl not-italic" aria-label="Indietro">
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate text-3xl font-black italic text-outline">{title}</h1>
        {coins !== undefined && <CoinBadge coins={coins} />}
      </header>
      <div className="pb-safe min-h-0 flex-1 overflow-y-auto overscroll-contain px-4" style={{ touchAction: "pan-y" }}>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Caricamento…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-lg font-black italic text-outline-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      {label}
    </div>
  );
}
