"use client";

import { useEffect, useRef, useState } from "react";
import type { Game, HudSnapshot } from "@/game/Game";
import { CONFIG } from "@/game/core/config";
import type { PowerupKind } from "@/game/core/items";
import type { UpgradeLevels } from "@/game/core/sim";
import { Hearts } from "./Hearts";
import { CoinIcon } from "./kit";
import { fmt } from "./loadout";
import { PauseOverlay } from "./PauseOverlay";

const POWERUPS: { kind: PowerupKind; label: string; icon: string; color: string }[] = [
  { kind: "turbo", label: "Turbo", icon: "🔥", color: "#ff6d00" },
  { kind: "shield", label: "Scudo", icon: "🛡️", color: "#29b6f6" },
  { kind: "magnet", label: "Magnete", icon: "🧲", color: "#e53935" },
  { kind: "wide", label: "Strada larga", icon: "↔️", color: "#43a047" },
  { kind: "slowmo", label: "Slow-mo", icon: "⏳", color: "#ab47bc" },
  { kind: "x2", label: "x2", icon: "✖️", color: "#fdd835" },
];

/** Durata piena di un power-up a tempo, per la barra (lo scudo non scade). */
function fullDuration(kind: PowerupKind, upgrades: UpgradeLevels): number {
  if (kind === "shield") return 1;
  if (kind === "wide") return CONFIG.powerupBase.wide;
  return CONFIG.powerupBase[kind] + upgrades[kind] * CONFIG.upgradePerLevel[kind];
}

interface Props {
  game: Game;
  bestScore: number;
  upgrades: UpgradeLevels;
  onExit: () => void;
  /** Chiamata solo quando cambia il bioma (non a ogni lettura). */
  onBiome?: (biome: number) => void;
}

export function Hud({ game, bestScore, upgrades, onExit, onBiome }: Props) {
  const [snap, setSnap] = useState<HudSnapshot>(() => game.hud());
  // il Game va in pausa da solo quando l'app passa in background: la UI lo scopre leggendo game.paused
  const [paused, setPaused] = useState(game.paused);
  const biomeRef = useRef<number | null>(null);
  const onBiomeRef = useRef(onBiome);
  useEffect(() => { onBiomeRef.current = onBiome; }, [onBiome]);

  useEffect(() => {
    const tick = () => {
      const s = game.hud();
      setSnap(s);
      setPaused(game.paused);
      if (s.biome !== biomeRef.current) { biomeRef.current = s.biome; onBiomeRef.current?.(s.biome); }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [game]);

  const pause = () => { game.pause(); setPaused(true); };
  const resume = () => { game.resume(); setPaused(false); };

  const best = Math.max(bestScore, snap.score);
  const active = POWERUPS.filter((p) => snap.powerups[p.kind] > 0);
  const chip = "box animate-pop w-[6.5rem] overflow-hidden px-2 py-1";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pt-safe flex items-start justify-between gap-2 px-4">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="box px-3 pt-1 pb-1.5">
            <div className="text-base leading-tight font-extrabold text-ui-accent tabular-nums">Best {fmt(best)}</div>
            <div className="text-5xl leading-none font-black tabular-nums">{fmt(snap.score)}</div>
          </div>
          {/* TODO(merge): hud.lives — sostituire il segnaposto con snap.lives quando HudSnapshot lo espone */}
          <Hearts lives={3} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-start gap-2">
            <div className="box flex h-11 min-w-14 items-center justify-center px-2.5" aria-label={`Combo ${snap.combo}`}>
              <span className={`text-4xl leading-none font-black tabular-nums ${snap.combo > 1 ? "text-ui-accent" : "text-white/70"}`}>
                {snap.combo}×
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.currentTarget.blur(); pause(); }}
              className="icon-btn pointer-events-auto"
              aria-label="Pausa"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <rect x="3" y="2" width="4" height="14" fill="currentColor" />
                <rect x="11" y="2" width="4" height="14" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div className="box flex items-center gap-1.5 px-2.5 py-1 text-xl font-extrabold text-ui-accent tabular-nums">
            <CoinIcon size={18} />
            <span aria-label={`${fmt(snap.coins)} monete`}>{fmt(snap.coins)}</span>
          </div>
        </div>
      </div>

      {(active.length > 0 || snap.boostTimer > 0) && (
        <div className="mt-2 flex flex-wrap gap-2 px-4">
          {snap.boostTimer > 0 && (
            <div className={chip}>
              <div className="flex items-center justify-between gap-1 text-sm font-extrabold">
                <span className="truncate">⚡ Boost</span>
              </div>
              <div className="mt-1 h-1.5 bg-white/20">
                <div className="h-full bg-ui-primary" style={{ width: `${Math.min(1, snap.boostTimer / CONFIG.boost.duration) * 100}%` }} />
              </div>
            </div>
          )}
          {active.map((p) => {
            const left = snap.powerups[p.kind];
            const frac = p.kind === "shield" ? 1 : Math.min(1, left / fullDuration(p.kind, upgrades));
            return (
              <div key={p.kind} className={chip}>
                <div className="flex items-center justify-between gap-1 text-sm font-extrabold">
                  <span className="truncate">{p.icon} {p.label}</span>
                  {p.kind !== "shield" && <span className="text-ui-accent tabular-nums">{Math.ceil(left)}s</span>}
                </div>
                <div className="mt-1 h-1.5 bg-white/20">
                  <div className="h-full" style={{ width: `${frac * 100}%`, background: p.color }} />
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
