import { useState } from "react";
import type { Profile } from "@/types/game";
import { showRewardedAd } from "@/lib/ads";
import { claimAdReward } from "@/lib/api";
import { CoinBadge } from "./kit";
import { fmt } from "./loadout";
import { hapticsEnabled, setHapticsEnabled, uiHaptic } from "./settings";

export type MenuTarget = "garage" | "shop" | "leaderboard";

export function Menu({
  profile,
  name,
  starting,
  shopAvailable,
  onPlay,
  onOpen,
  onProfileUpdate,
  toast,
}: {
  profile: Profile;
  name?: string;
  starting: boolean;
  shopAvailable: boolean;
  onPlay: () => void;
  onOpen: (s: MenuTarget) => void;
  onProfileUpdate?: (p: Profile) => void;
  toast?: (t: string) => void;
}) {
  const [adLoading, setAdLoading] = useState(false);

  const handleFreeCoins = async () => {
    if (adLoading) return;
    setAdLoading(true);
    try {
      const res = await showRewardedAd();
      if (!res.success) {
        toast?.(res.error || "Video non completato");
        return;
      }
      const data = await claimAdReward();
      if (data.success) {
        toast?.(`+${data.coinsEarned} Monete accreditate! 🪙`);
        onProfileUpdate?.(data.profile);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast?.(e?.message || "Riprova tra poco");
    } finally {
      setAdLoading(false);
    }
  };

  return (
    <div className="pt-safe pb-safe absolute inset-0 flex flex-col px-4">
      <div className="flex w-full items-start justify-between gap-2">
        <CoinBadge coins={profile.coins} />
        <HapticsToggle />
      </div>

      {/* logo nel terzo superiore */}
      <div className="flex flex-[1.1] flex-col items-center justify-center">
        <div className="animate-pop">
          <h1 className="logo text-center text-[6.5rem] min-[360px]:text-[7.5rem]" aria-label="Kart-Gram">
            <span className="block">KART</span>
            <span className="block">GRAM</span>
          </h1>
        </div>
        <p className="mt-4 text-lg font-extrabold">{name ? `Ciao ${name}, pronto` : "Pronto"} a derapare?</p>
      </div>

      <div className="mx-auto flex w-full max-w-[290px] flex-col gap-2">
        <button type="button" onClick={onPlay} disabled={starting} className="btn btn-primary h-14 text-3xl font-black">
          {starting ? "…" : "Gioca"}
        </button>

        {/* Pulsante Monete Gratis da Sponsor */}
        <button
          type="button"
          onClick={handleFreeCoins}
          disabled={adLoading}
          className="btn h-11 text-xl font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-900 hover:from-amber-400 hover:to-yellow-300 shadow-md"
        >
          {adLoading ? "Caricamento…" : "🎁 +50 Monete Gratis (Video)"}
        </button>

        <button type="button" onClick={() => onOpen("garage")} disabled={!shopAvailable} className="btn btn-secondary h-[50px] text-2xl">
          Garage
        </button>
        <button type="button" onClick={() => onOpen("shop")} disabled={!shopAvailable} className="btn btn-secondary h-[50px] text-2xl">
          Shop
        </button>
        <button type="button" onClick={() => onOpen("leaderboard")} className="btn btn-secondary h-[50px] text-2xl">
          Classifica
        </button>
        {!shopAvailable && (
          <p className="box px-3 py-1.5 text-center text-sm">Garage e Shop non disponibili: catalogo non raggiungibile</p>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-end gap-3 pt-4">
        <p className="text-center text-base font-extrabold">Tieni premuto a sinistra o a destra per derapare</p>
        <div className="box self-start px-3 py-2 text-lg leading-tight font-extrabold">
          <div>Modalità: <span className="text-ui-accent">Infinite Drift</span></div>
          <div>Best score: <span className="text-ui-accent">⭐ {fmt(profile.bestScore)} pt</span></div>
        </div>
      </div>
    </div>
  );
}

/** Interruttore vibrazione (salvato in localStorage). */
function HapticsToggle() {
  const [on, setOn] = useState(hapticsEnabled);
  const toggle = () => {
    const next = !on;
    setHapticsEnabled(next);
    setOn(next);
    if (next) uiHaptic("light");
  };
  return (
    <button type="button" onClick={toggle} className="icon-btn" aria-pressed={on} aria-label={on ? "Vibrazione attiva" : "Vibrazione disattivata"}>
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden className={on ? "" : "opacity-60"}>
        <rect x="7.5" y="3" width="9" height="18" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <line x1="4" y1="8" x2="4" y2="16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="20" y1="8" x2="20" y2="16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
