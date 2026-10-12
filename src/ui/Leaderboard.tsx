"use client";

import { useEffect, useState } from "react";
import type { Backend, LeaderboardEntry, Profile } from "@/backend/types";
import { errorText } from "./errors";
import { Screen, Spinner } from "./kit";
import { fmt } from "./loadout";

type Scope = "global" | "weekly";
const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ backend, profile, toast, onBack }: { backend: Backend; profile: Profile; toast: (t: string) => void; onBack: () => void }) {
  const [scope, setScope] = useState<Scope>("global");
  const [data, setData] = useState<{ scope: Scope; entries: LeaderboardEntry[] | null } | null>(null);

  useEffect(() => {
    let alive = true;
    backend.getLeaderboard(scope).then(
      (entries) => { if (alive) setData({ scope, entries }); },
      (err) => { if (alive) { setData({ scope, entries: null }); toast(errorText(err)); } },
    );
    return () => { alive = false; };
  }, [backend, scope, toast]);

  const shown = data?.scope === scope ? data : null;

  return (
    <Screen title="Classifica" onBack={onBack}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["global", "weekly"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s} className={`btn text-base ${scope === s ? "btn-yellow" : "btn-gray"}`}>
            {s === "global" ? "Globale" : "Settimanale"}
          </button>
        ))}
      </div>

      {!shown ? (
        <Spinner />
      ) : !shown.entries ? (
        <p className="py-10 text-center font-bold text-outline-sm">Classifica non disponibile</p>
      ) : shown.entries.length === 0 ? (
        <p className="py-10 text-center font-bold text-outline-sm">Ancora nessun punteggio</p>
      ) : (
        <ol className="flex flex-col gap-2 pb-4">
          {shown.entries.map((e) => {
            const me = e.userId === profile.userId;
            return (
              <li
                key={e.userId}
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 ${me ? "border-2 border-[#1b1035] bg-[#ffd23f] text-[#1b1035]" : "panel"}`}
              >
                <span className="w-9 shrink-0 text-center text-xl font-black italic">{MEDALS[e.rank - 1] ?? e.rank}</span>
                <span className={`min-w-0 flex-1 truncate text-lg font-bold ${me ? "" : "text-outline-sm"}`}>
                  {e.name}{me && e.name.toLowerCase() !== "tu" && " (tu)"}
                </span>
                <span className={`text-lg font-black italic tabular-nums ${me ? "" : "text-outline-sm"}`}>{fmt(e.score)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </Screen>
  );
}
