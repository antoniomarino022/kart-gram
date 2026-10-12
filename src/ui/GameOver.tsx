import { REVIVE_PRICE } from "@/backend/catalog";
import type { Profile, RevivePay } from "@/backend/types";
import { fmt } from "./loadout";

export interface RunSummary {
  score: number;
  coins: number;
  distance: number;
  revived: boolean;
  /** caduta nel vuoto o schianto (vite finite) */
  reason: "fall" | "crash";
  /** score > record noto a fine partita */
  newRecord: boolean;
}

interface Props {
  run: RunSummary;
  profile: Profile;
  unsaved: boolean;
  busy: boolean;
  onRevive: (pay: RevivePay) => void;
  onRetry: () => void;
  onMenu: () => void;
}

export function GameOver({ run, profile, unsaved, busy, onRevive, onRetry, onMenu }: Props) {
  return (
    <div className="pt-safe pb-safe absolute inset-0 z-10 flex flex-col items-center overflow-y-auto bg-[#1b1035]/55 px-5 backdrop-blur-[2px]">
      {/* my-auto invece di justify-center: se il contenuto è più alto dello schermo scorre senza tagliare la parte alta */}
      <div className="my-auto flex w-full max-w-sm flex-col items-center gap-4">
        <h1 className="text-4xl font-black whitespace-nowrap italic text-outline min-[360px]:text-5xl">GAME OVER</h1>
        <p className="-mt-2 text-lg font-bold text-outline-sm">{run.reason === "crash" ? "Schianto: vite finite" : "Sei caduto nel vuoto"}</p>

        <div className="panel w-full p-5 text-center">
          {run.newRecord && (
            <div className="animate-pop mb-1 text-2xl font-black italic text-[#ffd23f] text-outline">NUOVO RECORD!</div>
          )}
          <div className="text-sm font-bold tracking-widest text-white/80">SCORE</div>
          <div className="text-6xl leading-none font-black italic tabular-nums text-outline">{fmt(run.score)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-lg font-black italic">
            <div className="rounded-xl bg-white/10 py-2">🪙 +{fmt(run.coins)}</div>
            <div className="rounded-xl bg-white/10 py-2">📏 {fmt(run.distance)} m</div>
          </div>
          {unsaved && <p className="mt-3 text-sm font-bold text-[#ffb4a8]">Partita non salvata (offline)</p>}
        </div>

        {/* una partita offline (senza runId del backend) non può essere rianimata */}
        {!run.revived && !unsaved && (
          <div className="panel flex w-full flex-col gap-3 p-4">
            <div className="text-center text-lg font-black italic text-outline-sm">Continua la corsa?</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
              <button type="button" disabled={busy || profile.coins < REVIVE_PRICE.coins} onClick={() => onRevive("coins")} className="btn btn-yellow px-2 text-sm whitespace-nowrap">
                Continua · {REVIVE_PRICE.coins} 🪙
              </button>
              <button type="button" disabled={busy} onClick={() => onRevive("stars")} className="btn btn-purple px-2 text-sm whitespace-nowrap">
                Continua · {REVIVE_PRICE.stars} ⭐
              </button>
            </div>
            {profile.revives > 0 && (
              <button type="button" disabled={busy} onClick={() => onRevive("owned")} className="btn btn-orange">
                Usa revive ({profile.revives})
              </button>
            )}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={onRetry} className="btn btn-green h-16 text-xl whitespace-nowrap min-[360px]:text-2xl">
            ↻ Riprova
          </button>
          <button type="button" disabled={busy} onClick={onMenu} className="btn btn-white h-16 text-xl whitespace-nowrap min-[360px]:text-2xl">
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
