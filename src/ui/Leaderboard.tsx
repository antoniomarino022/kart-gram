"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardEntry, Profile } from "@/types/game";
import { errorText } from "./errors";
import { Screen, Spinner } from "./kit";
import { fmt } from "./loadout";

type Scope = "global" | "weekly";
const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ profile, toast, onBack }: { profile: Profile; toast: (t: string) => void; onBack: () => void }) {
  const [scope, setScope] = useState<Scope>("global");
  const [data, setData] = useState<{ scope: Scope; entries: LeaderboardEntry[] | null } | null>(null);

  useEffect(() => {
    let alive = true;
    getLeaderboard(scope).then(
      (entries) => { if (alive) setData({ scope, entries }); },
      (err) => { if (alive) { setData({ scope, entries: null }); toast(errorText(err)); } },
    );
    return () => { alive = false; };
  }, [scope, toast]);

  const shown = data?.scope === scope ? data : null;

  return (
    <Screen title="Classifica" onBack={onBack}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["global", "weekly"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s} className={`btn text-xl ${scope === s ? "btn-primary" : "btn-secondary"}`}>
            {s === "global" ? "Globale" : "Settimanale"}
          </button>
        ))}
      </div>

      {!shown ? (
        <Spinner />
      ) : !shown.entries ? (
        <p className="box my-6 px-3 py-4 text-center text-lg">Classifica non disponibile</p>
      ) : shown.entries.length === 0 ? (
        <p className="box my-6 px-3 py-4 text-center text-lg">Ancora nessun punteggio</p>
      ) : (
        <ol className="flex flex-col gap-1.5 pb-4">
          {shown.entries.map((e) => {
            const me = e.userId === profile.userId;
            return (
              <li
                key={e.userId}
                className={`flex min-h-12 items-center gap-3 rounded-[var(--ui-radius)] px-3 py-2 ${me ? "bg-ui-primary text-ui-primary-text" : "box"}`}
              >
                <span className="w-9 shrink-0 text-center text-2xl font-black">{MEDALS[e.rank - 1] ?? e.rank}</span>
                <span className="min-w-0 flex-1 truncate text-xl font-extrabold normal-case">
                  {e.name}{me && e.name.toLowerCase() !== "tu" && " (tu)"}
                </span>
                <span className={`text-2xl font-black tabular-nums ${me ? "" : "text-ui-accent"}`}>{fmt(e.score)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </Screen>
  );
}
