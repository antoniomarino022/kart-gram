"use client";

import { useState } from "react";
import {
  buyUpgrade,
  buyWithCoins,
  buyWithStars,
  equip as equipApi,
  getProfile,
} from "@/lib/api";
import { MAX_UPGRADE_LEVEL, UPGRADE_COSTS } from "@/lib/constants";
import type { CatalogItem, Profile, Slot, UpgradeId } from "@/types/game";
import { errorText } from "./errors";
import { CoinIcon, Screen } from "./kit";
import type { TrackProfile } from "./profileSync";
import { fmt } from "./loadout";

type Tab = Slot | "upgrades";

const TABS: { id: Tab; label: string }[] = [
  { id: "kart", label: "Kart" },
  { id: "paint", label: "Vernice" },
  { id: "wheels", label: "Ruote" },
  { id: "trail", label: "Scia" },
  { id: "upgrades", label: "Potenziamenti" },
];

const UPGRADES: { id: UpgradeId; name: string; icon: string; perLevel: string }[] = [
  { id: "magnet", name: "Magnete", icon: "🧲", perLevel: "+1 s per livello" },
  { id: "slowmo", name: "Slow-mo", icon: "⏳", perLevel: "+0,5 s per livello" },
  { id: "x2", name: "x2 Score", icon: "✖️", perLevel: "+1 s per livello" },
  { id: "ghost", name: "Ghost", icon: "👻", perLevel: "+0,5 s per livello" },
];

interface Props {
  profile: Profile;
  catalog: CatalogItem[];
  track: TrackProfile;
  toast: (text: string) => void;
  onBack: () => void;
}

export function Garage({ profile, catalog, track, toast, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("kart");
  const [busy, setBusy] = useState<string | null>(null);

  /** Esegue l'azione; su errore mostra il toast e riallinea il profilo (un acquisto può essere andato a buon fine). */
  async function act(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast(errorText(err));
      track(getProfile()).catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  const equipSlot = (it: CatalogItem) => track(equipApi(it.kind as Slot, it.id));
  const equip = (it: CatalogItem) => act(it.id, async () => { await equipSlot(it); });
  // l'acquisto si applica subito; l'equipaggiamento è un passo separato, così se fallisce l'oggetto resta comprato
  const buyCoins = (it: CatalogItem) => act(it.id, async () => {
    await track(buyWithCoins(it.id));
    toast(`${it.name} sbloccato!`);
    await equipSlot(it);
  });
  const buyStars = (it: CatalogItem) => act(it.id, async () => {
    if (!(await track(buyWithStars(it)))) { toast("Pagamento non completato"); return; }
    toast(`${it.name} sbloccato!`);
    await equipSlot(it);
  });
  const upgrade = (id: UpgradeId) => act(id, async () => { await track(buyUpgrade(id)); toast("Potenziamento migliorato!"); });

  const items = tab === "upgrades" ? [] : catalog.filter((i) => i.kind === tab);

  return (
    <Screen title="Garage" coins={profile.coins} onBack={onBack}>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" style={{ touchAction: "pan-x" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`btn shrink-0 px-4 text-xl ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "upgrades" ? (
        <div className="flex flex-col gap-3 pb-4">
          {UPGRADES.map((u) => {
            const level = profile.upgrades[u.id] ?? 0;
            const maxed = level >= MAX_UPGRADE_LEVEL;
            const cost = maxed ? 0 : UPGRADE_COSTS[level];
            return (
              <div key={u.id} className="box flex items-center gap-3 p-3">
                <div className="text-3xl" aria-hidden>{u.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-xl leading-tight font-extrabold">{u.name}</div>
                  <div className="text-sm text-white/80 normal-case">{u.perLevel}</div>
                  <div className="mt-1.5 flex gap-1.5" aria-label={`Livello ${level} di ${MAX_UPGRADE_LEVEL}`}>
                    {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                      <span key={i} className={`h-2.5 w-5 ${i < level ? "bg-ui-primary" : "bg-white/20"}`} />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={maxed || busy !== null || profile.coins < cost}
                  onClick={() => upgrade(u.id)}
                  className="btn btn-primary w-28 shrink-0 flex-col gap-0 px-2 py-1 text-lg leading-tight"
                >
                  {maxed ? "MAX" : <>Migliora<span className="flex items-center gap-1 text-sm"><CoinIcon size={14} />{fmt(cost)}</span></>}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-4">
          {items.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              owned={profile.owned.includes(it.id)}
              equipped={profile.equipped[it.kind as Slot] === it.id}
              coins={profile.coins}
              busy={busy !== null}
              onEquip={() => equip(it)}
              onBuyCoins={() => buyCoins(it)}
              onBuyStars={() => buyStars(it)}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}

function Swatch({ item }: { item: CatalogItem }) {
  if (item.kind === "paint" || item.kind === "trail") {
    const bg = item.id === "trail_rainbow"
      ? "conic-gradient(#ff3b3b, #ffd23f, #2dc653, #3a86ff, #8338ec, #ff3b3b)"
      : item.finish === "metal"
        ? `linear-gradient(135deg, #fff, ${item.color} 45%, #6b7780)`
        : item.color;
    return (
      <div
        className="h-14 w-14 rounded-full"
        style={{ background: bg, boxShadow: item.finish === "neon" ? `0 0 16px 4px ${item.color}` : undefined }}
      />
    );
  }
  return (
    <div className="flex h-14 w-full flex-col items-center justify-center rounded-[var(--ui-radius)] bg-white/10">
      <span className="text-3xl leading-none" aria-hidden>{item.kind === "kart" ? "🏎️" : "🛞"}</span>
      <span className="mt-0.5 max-w-full truncate text-xs text-white/70">{item.model?.replace(/\.glb$/, "")}</span>
    </div>
  );
}

function ItemCard(props: {
  item: CatalogItem; owned: boolean; equipped: boolean; coins: number; busy: boolean;
  onEquip: () => void; onBuyCoins: () => void; onBuyStars: () => void;
}) {
  const { item, owned, equipped, coins, busy } = props;
  return (
    <div className={`box flex flex-col items-center gap-2 p-3 ${equipped ? "outline-3 outline-ui-primary" : ""}`}>
      <Swatch item={item} />
      <div className="w-full truncate text-center text-xl leading-tight font-extrabold">{item.name}</div>
      {equipped ? (
        <div className="flex min-h-11 w-full items-center justify-center text-lg font-extrabold text-ui-accent">
          ✓ Equipaggiato
        </div>
      ) : owned ? (
        <button type="button" disabled={busy} onClick={props.onEquip} className="btn btn-secondary w-full bg-white/15 text-lg">
          Equipaggia
        </button>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {item.priceCoins !== undefined && (
            <button type="button" disabled={busy || coins < item.priceCoins} onClick={props.onBuyCoins} className="btn btn-primary w-full text-lg">
              <CoinIcon size={18} />{fmt(item.priceCoins)}
            </button>
          )}
          {item.priceStars !== undefined && (
            <button type="button" disabled={busy} onClick={props.onBuyStars} className="btn btn-stars w-full text-lg">
              ⭐ {item.priceStars}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
