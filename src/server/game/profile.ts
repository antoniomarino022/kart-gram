import { eq, max } from "drizzle-orm";
import { db } from "@/db";
import { playerItems, playerUpgrades } from "@/db/schema";
import { DEFAULT_EQUIPPED } from "@/backend/catalog";
import type { Profile, Slot } from "@/backend/types";
import { NO_UPGRADES, type UpgradeLevels } from "@/game/core/sim";
import type { ItemRow } from "@/types/game";
import { isFree, loadItems } from "./catalog";
import { SLOTS } from "./constants";
import { getPlayer, playerName } from "./player";

export async function upgradeLevels(userId: number): Promise<UpgradeLevels> {
  const rows = await db
    .select({
      id: playerUpgrades.upgradeId,
      level: max(playerUpgrades.level),
    })
    .from(playerUpgrades)
    .where(eq(playerUpgrades.userId, userId))
    .groupBy(playerUpgrades.upgradeId);

  const levels = { ...NO_UPGRADES };

  for (const row of rows) {
    if (row.id in levels) {
      levels[row.id as keyof UpgradeLevels] = row.level ?? 0;
    }
  }

  return levels;
}

/** Id posseduti: oggetti gratuiti del catalogo + comprati/regalati. */
export async function ownedIds(userId: number, allItems?: ItemRow[]): Promise<Set<string>> {
  const [catalog, ownedRows] = await Promise.all([
    allItems ?? loadItems({ activeOnly: false }),
    db
      .select({ id: playerItems.itemId })
      .from(playerItems)
      .where(eq(playerItems.userId, userId)),
  ]);

  const freeIds = catalog.filter(isFree).map((item) => item.id);
  const acquiredIds = ownedRows.map((row) => row.id);

  return new Set([...freeIds, ...acquiredIds]);
}

/** Equipaggiamento valido: per ogni slot l'oggetto scelto se posseduto e adatto, altrimenti quello di default. */
export function resolveEquipped(
  saved: Record<string, string>,
  owned: Set<string>,
  allItems: ItemRow[],
): Record<Slot, string> {
  const kindById = new Map(allItems.map((item) => [item.id, item.kind]));
  const equipped = { ...DEFAULT_EQUIPPED };

  for (const slot of SLOTS) {
    const id = saved[slot];
    if (id && owned.has(id) && kindById.get(id) === slot) {
      equipped[slot] = id;
    }
  }

  return equipped;
}

export async function buildProfile(userId: number): Promise<Profile> {
  const [player, allItems, upgrades] = await Promise.all([
    getPlayer(userId),
    loadItems({ activeOnly: false }),
    upgradeLevels(userId),
  ]);

  const owned = await ownedIds(userId, allItems);

  return {
    userId: String(player.id),
    name: playerName(player),
    coins: player.coins,
    bestScore: player.allTimeHighScore,
    owned: [...owned],
    equipped: resolveEquipped(player.equipped, owned, allItems),
    upgrades,
    revives: player.revives,
  };
}
