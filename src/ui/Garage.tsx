"use client";

import { useState } from "react";
import { MAX_UPGRADE_LEVEL, UPGRADE_COSTS } from "@/backend/catalog";
import { buyWithStars } from "@/backend/purchase";
import type { Backend, CatalogItem, Profile, Slot, UpgradeId } from "@/backend/types";
import { errorText } from "./errors";
import { Screen } from "./kit";
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
  { id: "turbo", name: "Turbo", icon: "🔥", perLevel: "+0,5 s per livello" },
  { id: "magnet", name: "Magnete", icon: "🧲", perLevel: "+1 s per livello" },
  { id: "slowmo", name: "Slow-mo", icon: "⏳", perLevel: "+0,5 s per livello" },
  { id: "x2", name: "x2 Score", icon: "✖️", perLevel: "+1 s per livello" },
];

interface Props {
  backend: Backend;
  profile: Profile;
  catalog: CatalogItem[];
  onProfile: (p: Profile) => void;
  toast: (text: string) => void;
  onBack: () => void;
}

export function Garage({ backend, profile, catalog, onProfile, toast, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("kart");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<Profile | null>, okText?: string) {
    if (busy) return;
    setBusy(key);
    try {
      const p = await fn();
      if (p) { onProfile(p); if (okText) toast(okText); }
      else toast("Pagamento non completato");
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const equip = (it: CatalogItem) => act(it.id, () => backend.equip(it.kind as Slot, it.id));
  const buyCoins = (it: CatalogItem) =>
    act(it.id, async () => { await backend.buyWithCoins(it.id); return backend.equip(it.kind as Slot, it.id); }, `${it.name} sbloccato!`);
  const buyStars = (it: CatalogItem) =>
    act(it.id, async () => (await buyWithStars(backend, it.id)) && backend.equip(it.kind as Slot, it.id), `${it.name} sbloccato!`);
  const upgrade = (id: UpgradeId) => act(id, () => backend.buyUpgrade(id), "Potenziamento migliorato!");

  const items = tab === "upgrades" ? [] : catalog.filter((i) => i.kind === tab);

  return (
    <Screen title="Garage" coins={profile.coins} onBack={onBack}>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" style={{ touchAction: "pan-x" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`btn shrink-0 px-4 text-base ${tab === t.id ? "btn-yellow" : "btn-gray"}`}
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
              <div key={u.id} className="panel flex items-center gap-3 p-3">
                <div className="text-3xl" aria-hidden>{u.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-black italic text-outline-sm">{u.name}</div>
                  <div className="text-xs text-white/80">{u.perLevel}</div>
                  <div className="mt-1.5 flex gap-1.5" aria-label={`Livello ${level} di ${MAX_UPGRADE_LEVEL}`}>
                    {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                      <span key={i} className={`h-3 w-3 rounded-full border-2 border-[#1b1035] ${i < level ? "bg-[#ffd23f]" : "bg-white/25"}`} />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={maxed || busy !== null || profile.coins < cost}
                  onClick={() => upgrade(u.id)}
                  className="btn btn-green w-28 shrink-0 flex-col gap-0 px-2 py-1 text-sm leading-tight"
                >
                  {maxed ? "MAX" : <>Migliora<span className="text-xs not-italic">🪙 {fmt(cost)}</span></>}
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
        className="h-14 w-14 rounded-full border-4 border-[#1b1035]"
        style={{ background: bg, boxShadow: item.finish === "neon" ? `0 0 16px 4px ${item.color}` : undefined }}
      />
    );
  }
  return (
    <div className="flex h-14 w-full flex-col items-center justify-center rounded-xl bg-white/10">
      <span className="text-3xl leading-none" aria-hidden>{item.kind === "kart" ? "🏎️" : "🛞"}</span>
      <span className="mt-0.5 max-w-full truncate font-mono text-[10px] text-white/70">{item.model?.replace(/\.glb$/, "")}</span>
    </div>
  );
}

function ItemCard(props: {
  item: CatalogItem; owned: boolean; equipped: boolean; coins: number; busy: boolean;
  onEquip: () => void; onBuyCoins: () => void; onBuyStars: () => void;
}) {
  const { item, owned, equipped, coins, busy } = props;
  return (
    <div className={`panel flex flex-col items-center gap-2 p-3 ${equipped ? "ring-4 ring-[#ffd23f]" : ""}`}>
      <Swatch item={item} />
      <div className="w-full truncate text-center text-base font-black italic text-outline-sm">{item.name}</div>
      {equipped ? (
        <div className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#ffd23f]/20 text-sm font-black italic text-[#ffd23f]">
          ✓ Equipaggiato
        </div>
      ) : owned ? (
        <button type="button" disabled={busy} onClick={props.onEquip} className="btn btn-white w-full text-sm">
          Equipaggia
        </button>
      ) : (
        <div className="flex w-full flex-col gap-2">
          {item.priceCoins !== undefined && (
            <button type="button" disabled={busy || coins < item.priceCoins} onClick={props.onBuyCoins} className="btn btn-yellow w-full text-sm">
              🪙 {fmt(item.priceCoins)}
            </button>
          )}
          {item.priceStars !== undefined && (
            <button type="button" disabled={busy} onClick={props.onBuyStars} className="btn btn-purple w-full text-sm">
              ⭐ {item.priceStars}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
