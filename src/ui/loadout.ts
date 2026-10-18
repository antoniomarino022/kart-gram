import { DEFAULT_EQUIPPED } from "@/lib/constants";
import type { CatalogItem, Profile } from "@/types/game";
import type { Loadout } from "@/game/render/GameRenderer";

/** Loadout del renderer dagli oggetti equipaggiati; se un id non è nel catalogo usa quello di default. */
export function buildLoadout(equipped: Profile["equipped"], catalog: CatalogItem[]): Loadout {
  const find = (slot: keyof Profile["equipped"]) =>
    catalog.find((i) => i.id === equipped[slot] && i.kind === slot) ?? catalog.find((i) => i.id === DEFAULT_EQUIPPED[slot]);
  const kart = find("kart"), wheels = find("wheels"), paint = find("paint"), trail = find("trail");
  return {
    kartModel: kart?.model ?? "kart_classic",
    wheelModel: wheels?.model ?? "wheel_basic",
    paint: { color: paint?.color ?? "#e63946", finish: paint?.finish ?? "flat" },
    trailColor: trail?.color ?? "#d9d9d9",
    trailId: trail?.id ?? "trail_smoke",
  };
}

export const loadoutKey = (l: Loadout) => [l.kartModel, l.wheelModel, l.paint.color, l.paint.finish, l.trailId].join("|");

// separatore delle migliaia anche a 4 cifre (in it-IT di default 5000 resterebbe "5000")
const NUM = new Intl.NumberFormat("it-IT", { useGrouping: "always" });
export const fmt = (n: number) => NUM.format(Math.floor(n));
