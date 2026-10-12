"use client";

import { useEffect, useState } from "react";
import type { Game, HudSnapshot } from "@/game/Game";
import { CONFIG } from "@/game/core/config";
import type { PowerupKind } from "@/game/core/items";
import type { UpgradeLevels } from "@/game/core/sim";
import { FirstRunHint } from "./FirstRunHint";
import { fmt } from "./loadout";
import { PauseOverlay } from "./PauseOverlay";

const POWERUPS: { kind: PowerupKind; label: string; icon: string; color: string }[] = [
  { kind: "turbo", label: "Turbo", icon: "🔥", color: "#ff6d00" },
  { kind: "shield", label: "Scudo", icon: "🛡️", color: "#29b6f6" },
  { kind: "magnet", label: "Magnete", icon: "🧲", color: "#e53935" },
  { kind: "wide", label: "Strada larga", icon: "↔️", color: "#43a047" },
  { kind: "slowmo", label: "Slow-mo", icon: "⏳", color: "#8e24aa" },
  { kind: "x2", label: "x2", icon: "✖️", color: "#fdd835" },
];

/** Durata piena di un power-up a tempo, per la barra (lo scudo non scade). */
function fullDuration(kind: PowerupKind, upgrades: UpgradeLevels): number {
  if (kind === "shield" || kind === "heart") return 1;
  if (kind === "wide") return CONFIG.powerupBase.wide;
  return CONFIG.powerupBase[kind] + upgrades[kind] * CONFIG.upgradePerLevel[kind];
}

export function Hud({ game, bestScore, upgrades, onExit }: { game: Game; bestScore: number; upgrades: UpgradeLevels; onExit: () => void }) {
  const [snap, setSnap] = useState<HudSnapshot>(() => game.hud());
  // il Game va in pausa da solo quando l'app passa in background: la UI lo scopre leggendo game.paused
  const [paused, setPaused] = useState(game.paused);

  useEffect(() => {
    const id = setInterval(() => {
      setSnap(game.hud());
      setPaused(game.paused);
    }, 100);
    return () => clearInterval(id);
  }, [game]);

  const pause = () => { game.pause(); setPaused(true); };
  const resume = () => { game.resume(); setPaused(false); };

  const best = Math.max(bestScore, snap.score);
  const active = POWERUPS.filter((p) => snap.powerups[p.kind] > 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <FirstRunHint />
      <div className="pt-safe flex items-start justify-between gap-2 px-4">
        <div className="min-w-0">
          <div className="text-sm font-black italic tracking-wide text-outline-sm">BEST {fmt(best)}</div>
          <div className="text-5xl leading-none font-black italic tabular-nums text-outline">{fmt(snap.score)}</div>
          <div className="mt-1 text-lg font-black italic text-outline-sm">🪙 {fmt(snap.coins)}</div>
          <div className="text-lg leading-none" aria-label={`${snap.lives} vite`}>{"❤️".repeat(snap.lives)}{"🤍".repeat(Math.max(0, CONFIG.lives - snap.lives))}</div>
        </div>
        <div className="flex items-start gap-3">
          <div
            className={`text-5xl leading-none font-black italic text-outline transition-transform ${snap.combo > 1 ? "scale-110 text-[#ffd23f]" : "opacity-70"}`}
            aria-label={`Combo ${snap.combo}`}
          >
            {snap.combo}×
          </div>
          <button
            type="button"
            onClick={(e) => { e.currentTarget.blur(); pause(); }}
            className="btn btn-white pointer-events-auto h-11 w-11 px-0 text-lg not-italic"
            aria-label="Pausa"
          >
            ❚❚
          </button>
        </div>
      </div>

      {active.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 px-4">
          {active.map((p) => {
            const left = snap.powerups[p.kind];
            const frac = p.kind === "shield" ? 1 : Math.min(1, left / fullDuration(p.kind, upgrades));
            return (
              <div key={p.kind} className="panel animate-pop w-24 overflow-hidden rounded-xl px-2 py-1">
                <div className="flex items-center justify-between gap-1 text-xs font-black italic text-outline-sm">
                  <span className="truncate">{p.icon} {p.label}</span>
                  {p.kind !== "shield" && <span className="tabular-nums">{Math.ceil(left)}s</span>}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/25">
                  <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: p.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paused && <PauseOverlay onResume={resume} onExit={onExit} />}
    </div>
  );
}
