import type { Profile } from "@/backend/types";
import { CoinBadge } from "./kit";
import { fmt } from "./loadout";

export type MenuTarget = "garage" | "shop" | "leaderboard";

export function Menu({ profile, name, starting, shopAvailable, onPlay, onOpen }: { profile: Profile; name?: string; starting: boolean; shopAvailable: boolean; onPlay: () => void; onOpen: (s: MenuTarget) => void }) {
  return (
    <div className="pt-safe pb-safe absolute inset-0 flex flex-col items-center bg-gradient-to-b from-[#1b1035]/40 via-transparent to-[#1b1035]/70 px-5">
      <div className="flex w-full items-center justify-between">
        <div className="panel rounded-full px-3 py-1.5 text-sm font-black italic text-outline-sm">
          🏆 BEST {fmt(profile.bestScore)}
        </div>
        <CoinBadge coins={profile.coins} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <h1 className="animate-pop -rotate-3 text-center text-[3.4rem] leading-none font-black whitespace-nowrap italic tracking-tight text-outline sm:text-7xl">
          KART<span className="text-[#ffd23f]">-</span>GRAM
        </h1>
        <p className="mt-3 text-base font-bold italic text-outline-sm">{name ? `Ciao ${name}, pronto` : "Pronto"} a derapare?</p>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <button type="button" onClick={onPlay} disabled={starting} className="btn btn-green h-20 w-full text-4xl">
          {starting ? "…" : "▶ GIOCA"}
        </button>
        <div className="grid w-full grid-cols-3 gap-3">
          <button type="button" onClick={() => onOpen("garage")} disabled={!shopAvailable} className="btn btn-orange flex-col gap-0 px-1 py-2 text-sm">
            <span className="text-2xl not-italic">🏎️</span>Garage
          </button>
          <button type="button" onClick={() => onOpen("shop")} disabled={!shopAvailable} className="btn btn-purple flex-col gap-0 px-1 py-2 text-sm">
            <span className="text-2xl not-italic">⭐</span>Shop
          </button>
          <button type="button" onClick={() => onOpen("leaderboard")} className="btn btn-yellow flex-col gap-0 px-1 py-2 text-sm">
            <span className="text-2xl not-italic">🏆</span>Classifica
          </button>
        </div>
        {!shopAvailable && (
          <p className="text-center text-xs font-bold text-[#ffb4a8] text-outline-sm">Garage e Shop non disponibili: catalogo non raggiungibile</p>
        )}
        <p className="mt-1 mb-2 text-center text-sm font-bold text-outline-sm">Tieni premuto per derapare</p>
      </div>
    </div>
  );
}
