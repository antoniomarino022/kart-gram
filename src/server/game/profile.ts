import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import { playerItems, playerUpgrades } from "@/db/schema";
import { DEFAULT_EQUIPPED } from "@/backend/catalog";
import type { Profile, Slot } from "@/backend/types";
import { NO_UPGRADES, type UpgradeLevels } from "@/game/core/sim";
import { isFree, loadItems, type ItemRow } from "./catalog";
import { getPlayer, playerName } from "./player";

const SLOTS: Slot[] = ["kart", "paint", "wheels", "trail"];

export async function upgradeLevels(userId: number): Promise<UpgradeLevels> {
  const rows = await db
    .select({ id: playerUpgrades.upgradeId, level: max(playerUpgrades.level) })
    .from(playerUpgrades)
    .where(eq(playerUpgrades.userId, userId))
    .groupBy(playerUpgrades.upgradeId);
  const levels = { ...NO_UPGRADES };
  for (const r of rows) if (r.id in levels) levels[r.id as keyof UpgradeLevels] = r.level ?? 0;
  return levels;
}

/** Id posseduti: oggetti gratuiti del catalogo + comprati/regalati. */
export async function ownedIds(userId: number, all?: ItemRow[]): Promise<Set<string>> {
  const [catalog, rows] = await Promise.all([
    all ?? loadItems({ activeOnly: false }),
    db.select({ id: playerItems.itemId }).from(playerItems).where(eq(playerItems.userId, userId)),
  ]);
  return new Set([...catalog.filter(isFree).map((i) => i.id), ...rows.map((r) => r.id)]);
}

/** Equipaggiamento valido: per ogni slot l'oggetto scelto se posseduto e adatto, altrimenti quello di default. */
export function resolveEquipped(saved: Record<string, string>, owned: Set<string>, all: ItemRow[]): Record<Slot, string> {
  const kindOf = new Map(all.map((i) => [i.id, i.kind]));
  const out = { ...DEFAULT_EQUIPPED };
  for (const slot of SLOTS) {
    const id = saved[slot];
    if (id && owned.has(id) && kindOf.get(id) === slot) out[slot] = id;
  }
  return out;
}

export async function buildProfile(userId: number): Promise<Profile> {
  const [player, all, upgrades] = await Promise.all([getPlayer(userId), loadItems({ activeOnly: false }), upgradeLevels(userId)]);
  const owned = await ownedIds(userId, all);
  return {
    userId: String(player.id),
    name: playerName(player),
    coins: player.coins,
    bestScore: player.allTimeHighScore,
    owned: [...owned],
    equipped: resolveEquipped(player.equipped, owned, all),
    upgrades,
    revives: player.revives,
  };
}
