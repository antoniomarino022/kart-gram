"use client";

import { useState } from "react";
import { isRemoteBackend } from "@/backend";
import { buyWithStars } from "@/backend/purchase";
import type { Backend, CatalogItem, Profile } from "@/backend/types";
import { errorText } from "./errors";
import { Screen } from "./kit";
import type { TrackProfile } from "./profileSync";
import { fmt } from "./loadout";

const COSMETIC_KINDS = ["kart", "paint", "wheels", "trail"];
const KIND_LABEL: Record<string, string> = { kart: "Kart", paint: "Vernice", wheels: "Ruote", trail: "Scia" };
const PACK_ICONS = ["💰", "🧰", "🏦"];

interface Props {
  backend: Backend;
  profile: Profile;
  catalog: CatalogItem[];
  track: TrackProfile;
  toast: (text: string) => void;
  onBack: () => void;
}

export function Shop({ backend, profile, catalog, track, toast, onBack }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function buy(it: CatalogItem) {
    if (busy) return;
    setBusy(it.id);
    try {
      const p = await track(buyWithStars(backend, it));
      if (!p) { toast("Pagamento non completato"); return; }
      toast(it.kind === "coin_pack" ? `+${fmt(it.coins ?? 0)} 🪙` : `${it.name} sbloccato!`);
    } catch (err) {
      toast(errorText(err));
      track(backend.getProfile()).catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  // il backend segna lo starter pack tra gli oggetti posseduti una volta comprato
  const starter = catalog.find((i) => i.kind === "starter_pack" && !profile.owned.includes(i.id));
  const packs = catalog.filter((i) => i.kind === "coin_pack" && i.priceStars !== undefined);
  const cosmetics = catalog.filter((i) => COSMETIC_KINDS.includes(i.kind) && i.priceStars !== undefined && i.priceCoins === undefined);
  const grantName = (id: string) => catalog.find((i) => i.id === id)?.name ?? id;

  return (
    <Screen title="Shop" coins={profile.coins} onBack={onBack}>
      {!isRemoteBackend() && (
        <div className="mb-3 inline-block rounded-[var(--ui-radius)] bg-ui-primary px-2.5 py-1 text-sm font-extrabold text-ui-primary-text">
          Modalità test: Stelle gratis
        </div>
      )}

      {starter && (
        <div className="animate-pop relative mb-5 overflow-hidden rounded-[var(--ui-radius)] bg-ui-primary p-4 text-ui-primary-text">
          <div className="absolute top-3 right-[-34px] rotate-45 bg-ui-primary-text px-10 py-0.5 text-sm font-extrabold text-white">Una volta</div>
          <div className="pr-10 text-4xl leading-none font-black">{starter.name}</div>
          <ul className="mt-2 space-y-0.5 text-lg font-extrabold">
            {(starter.grants ?? []).map((g) => <li key={g}>🏎️ Kart {grantName(g)}</li>)}
            {starter.coins ? <li>🪙 {fmt(starter.coins)} monete</li> : null}
            {starter.revives ? <li>💖 {starter.revives} revive</li> : null}
          </ul>
          <button type="button" disabled={busy !== null} onClick={() => buy(starter)} className="btn btn-dark mt-3 h-14 w-full text-3xl font-black">
            ⭐ {starter.priceStars}
          </button>
        </div>
      )}

      <h2 className="mb-2 text-2xl font-black">Monete</h2>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {packs.map((p, i) => (
          <div key={p.id} className="box flex flex-col items-center gap-1 p-2 text-center">
            <div className="text-3xl" aria-hidden>{PACK_ICONS[i] ?? "💰"}</div>
            <div className="text-2xl leading-none font-black text-ui-accent">{fmt(p.coins ?? 0)}</div>
            <div className="line-clamp-2 min-h-8 text-sm leading-tight text-white/80">{p.name}</div>
            <button type="button" disabled={busy !== null} onClick={() => buy(p)} className="btn btn-stars w-full px-1 text-lg">
              ⭐ {p.priceStars}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-2xl font-black">Esclusivi</h2>
      <div className="grid grid-cols-2 gap-3 pb-4">
        {cosmetics.map((c) => {
          const owned = profile.owned.includes(c.id);
          return (
            <div key={c.id} className="box flex flex-col gap-1 p-3">
              <div className="text-sm font-extrabold tracking-wider text-ui-accent">{KIND_LABEL[c.kind]}</div>
              <div className="flex items-center gap-2">
                {c.color && <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: c.color }} />}
                <span className="truncate text-xl font-extrabold">{c.name}</span>
              </div>
              {owned ? (
                <div className="flex min-h-11 items-center justify-center text-lg font-extrabold text-ui-accent">✓ Posseduto</div>
              ) : (
                <button type="button" disabled={busy !== null} onClick={() => buy(c)} className="btn btn-stars w-full text-lg">
                  ⭐ {c.priceStars}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
