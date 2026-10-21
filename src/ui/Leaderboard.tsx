"use client";

import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardEntry, LeaderboardScope, Profile } from "@/types/game";
import { errorText } from "./errors";
import { Screen, Spinner } from "./kit";
import { fmt } from "./loadout";

const MEDALS = ["🥇", "🥈", "🥉"];
const PRIZES = ["+150 🪙", "+100 🪙", "+50 🪙"];

export function Leaderboard({
  profile,
  toast,
  onBack,
}: {
  profile: Profile;
  toast: (t: string) => void;
  onBack: () => void;
}) {
  const [scope, setScope] = useState<LeaderboardScope>("score");
  const [data, setData] = useState<{ scope: LeaderboardScope; entries: LeaderboardEntry[] | null } | null>(null);

  useEffect(() => {
    let alive = true;
    getLeaderboard(scope).then(
      (entries) => {
        if (alive) setData({ scope, entries });
      },
      (err) => {
        if (alive) {
          setData({ scope, entries: null });
          toast(errorText(err));
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [scope, toast]);

  const shown = data?.scope === scope ? data : null;

  return (
    <Screen title="Classifica Mensile" onBack={onBack}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setScope("score")}
          aria-pressed={scope === "score"}
          className={`btn text-lg ${scope === "score" ? "btn-primary" : "btn-secondary"}`}
        >
          🏆 Punteggio
        </button>
        <button
          type="button"
          onClick={() => setScope("referrals")}
          aria-pressed={scope === "referrals"}
          className={`btn text-lg ${scope === "referrals" ? "btn-primary" : "btn-secondary"}`}
        >
          👥 Inviti
        </button>
      </div>

      {/* Banner Premi Mensili */}
      <div className="box mb-3 flex items-center justify-around border-2 border-yellow-500/40 bg-yellow-500/10 px-2 py-2 text-center text-xs font-bold text-yellow-300">
        <div>🥇 1°: 150 🪙</div>
        <div>🥈 2°: 100 🪙</div>
        <div>🥉 3°: 50 🪙</div>
      </div>

      {!shown ? (
        <Spinner />
      ) : !shown.entries ? (
        <p className="box my-6 px-3 py-4 text-center text-lg">Classifica non disponibile</p>
      ) : shown.entries.length === 0 ? (
        <p className="box my-6 px-3 py-4 text-center text-lg">
          {scope === "score" ? "Ancora nessun punteggio questo mese" : "Ancora nessun invito questo mese"}
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5 pb-4">
          {shown.entries.map((e) => {
            const me = e.userId === profile.userId;
            const prize = PRIZES[e.rank - 1];
            return (
              <li
                key={e.userId}
                className={`flex min-h-12 items-center gap-3 rounded-[var(--ui-radius)] px-3 py-2 ${
                  me ? "bg-ui-primary text-ui-primary-text" : "box"
                }`}
              >
                <span className="w-8 shrink-0 text-center text-2xl font-black">
                  {MEDALS[e.rank - 1] ?? e.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-extrabold normal-case">
                    {e.name}
                    {me && e.name.toLowerCase() !== "tu" && " (tu)"}
                  </div>
                  {prize && (
                    <span className="text-xs font-semibold text-yellow-400">
                      Premio fine mese: {prize}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-xl font-black tabular-nums ${me ? "" : "text-ui-accent"}`}>
                    {fmt(e.score)}
                  </span>
                  <span className="block text-[10px] font-semibold opacity-70">
                    {scope === "score" ? "pts" : "inviti"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Screen>
  );
}
