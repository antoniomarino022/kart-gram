import { useState } from "react";
import { REVIVE_PRICE } from "@/lib/constants";
import { showRewardedAd } from "@/lib/ads";
import type { Profile, RevivePay } from "@/types/game";
import { CoinIcon } from "./kit";
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
  const [adLoading, setAdLoading] = useState(false);

  const handleAdRevive = async () => {
    if (busy || adLoading) return;
    setAdLoading(true);
    try {
      const res = await showRewardedAd();
      if (res.success) {
        onRevive("ad");
      }
    } finally {
      setAdLoading(false);
    }
  };

  return (
    <div className="scrim pt-safe pb-safe absolute inset-0 z-10 flex flex-col items-center overflow-y-auto px-4">
      {/* my-auto invece di justify-center: se il contenuto è più alto dello schermo scorre senza tagliare la parte alta */}
      <div className="my-auto flex w-full max-w-[320px] flex-col items-center gap-2">
        <h1 className="logo text-center text-[4.5rem] min-[360px]:text-[5.5rem]">
          <span className="block">GAME</span>
          <span className="block">OVER</span>
        </h1>
        <div className="box mt-1 px-3 py-1 text-xl font-extrabold text-ui-accent">{run.reason === "crash" ? "Kart distrutto" : "Sei caduto"}</div>

        <div className="box mt-2 w-full px-4 py-3 text-center">
          {run.newRecord && (
            <div className="animate-pop mb-1 inline-block rounded-[var(--ui-radius)] bg-ui-primary px-2 py-0.5 text-xl font-black text-ui-primary-text">
              Nuovo record!
            </div>
          )}
          <div className="text-base font-extrabold text-ui-accent">Score</div>
          <div className="text-7xl leading-none font-black tabular-nums">{fmt(run.score)}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xl font-extrabold">
            <div className="flex items-center justify-center gap-1.5 rounded-[var(--ui-radius)] bg-white/10 py-1.5">
              <CoinIcon size={18} />+{fmt(run.coins)}
            </div>
            <div className="rounded-[var(--ui-radius)] bg-white/10 py-1.5">{fmt(run.distance)} m</div>
          </div>
          {unsaved && <p className="mt-2 text-sm text-ui-accent">Partita non salvata (offline)</p>}
        </div>

        {/* una partita offline (senza runId del backend) non può essere rianimata */}
        {!run.revived && !unsaved && (
          <div className="box flex w-full flex-col gap-2 p-3">
            <div className="text-center text-xl font-extrabold">Continua la corsa?</div>
            
            {/* Pulsante Revive con Sponsor Video */}
            <button
              type="button"
              disabled={busy || adLoading}
              onClick={handleAdRevive}
              aria-label="Rivivi guardando uno sponsor"
              className="btn btn-primary h-12 w-full text-xl font-black bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white shadow-lg"
            >
              {adLoading ? "Caricamento…" : "📺 Rivivi Gratis (Video)"}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy || adLoading || profile.coins < REVIVE_PRICE.coins} onClick={() => onRevive("coins")} aria-label={`Continua con ${REVIVE_PRICE.coins} monete`} className="btn btn-secondary px-1 text-lg whitespace-nowrap">
                <CoinIcon size={18} />{fmt(REVIVE_PRICE.coins)}
              </button>
              <button type="button" disabled={busy || adLoading} onClick={() => onRevive("stars")} aria-label={`Continua con ${REVIVE_PRICE.stars} Stelle`} className="btn btn-stars px-1 text-lg whitespace-nowrap">
                ⭐ {REVIVE_PRICE.stars}
              </button>
            </div>
            {profile.revives > 0 && (
              <button type="button" disabled={busy || adLoading} onClick={() => onRevive("owned")} aria-label="Usa un revive" className="btn btn-secondary text-lg">
                Usa revive ({profile.revives})
              </button>
            )}
          </div>
        )}

        <div className="mt-1 flex w-full flex-col gap-2">
          <button type="button" disabled={busy || adLoading} onClick={onRetry} className="btn btn-primary h-14 text-3xl font-black">
            Riprova
          </button>
          <button type="button" disabled={busy || adLoading} onClick={onMenu} className="btn btn-secondary h-[52px] text-2xl">
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
