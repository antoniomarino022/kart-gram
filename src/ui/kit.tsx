import type { ReactNode } from "react";
import { fmt } from "./loadout";

/** Moneta piatta: cerchio dorato con la "C". */
export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="shrink-0">
      <circle cx="10" cy="10" r="10" fill="#f2b705" />
      <circle cx="10" cy="10" r="7" fill="#ffd23f" />
      <path d="M12.6 7.4a3.6 3.6 0 1 0 0 5.2" fill="none" stroke="#b77d00" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Pill monete della barra in alto: icona moneta e importo nel colore accento. */
export function CoinBadge({ coins, className = "" }: { coins: number; className?: string }) {
  return (
    <div className={`box flex h-11 items-center gap-1.5 px-3 text-xl font-extrabold text-ui-accent tabular-nums ${className}`}>
      <CoinIcon />
      <span aria-label={`${fmt(coins)} monete`}>{fmt(coins)}</span>
    </div>
  );
}

/** Schermata a tutto schermo sopra il canvas: barra con "indietro", titolo e monete; contenuto scrollabile. */
export function Screen({ title, coins, onBack, children }: { title: string; coins?: number; onBack: () => void; children: ReactNode }) {
  return (
    <div className="scrim absolute inset-0 flex flex-col">
      <header className="pt-safe flex shrink-0 items-center gap-2 px-4 pb-3">
        <button type="button" onClick={onBack} className="icon-btn" aria-label="Indietro">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" />
          </svg>
        </button>
        <h1 className="box flex h-11 min-w-0 flex-1 items-center truncate px-3 text-3xl leading-none font-black">{title}</h1>
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
    <div className="flex flex-col items-center gap-3 py-10 text-lg font-extrabold">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-ui-primary" />
      {label}
    </div>
  );
}
