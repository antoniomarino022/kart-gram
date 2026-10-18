import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { playerUpgrades, telegramUsers } from "@/db/schema";
import { MAX_UPGRADE_LEVEL, UPGRADE_COSTS } from "@/backend/catalog";
import type { Profile, Slot, UpgradeId } from "@/backend/types";
import { CoinReason } from "@/types/enums";
import type { ItemRow } from "@/types/game";
import { bad } from "@/server/http";
import { withTx } from "@/server/tx";
import { activeItem, owns } from "./catalog";
import { spendCoins } from "./coins";
import { SLOTS, UPGRADE_IDS } from "./constants";
import { grantItem } from "./grant";
import { createInvoice } from "./payments";
import { lockPlayer } from "./player";
import { buildProfile, ownedIds } from "./profile";

// ---------------------------------------------------------------------------
// Garage
// ---------------------------------------------------------------------------

export async function equip(userId: number, slot: Slot, itemId: string): Promise<Profile> {
  if (!SLOTS.includes(slot)) {
    throw bad("Slot non valido");
  }

  await withTx(async (tx) => {
    const item = await activeItem(tx, itemId);
    if (item.kind !== slot) {
      throw bad("Oggetto non adatto a questo slot");
    }

    const isOwned = await owns(tx, userId, item);
    if (!isOwned) {
      throw bad("Oggetto non posseduto");
    }

    const player = await lockPlayer(tx, userId);

    await tx
      .update(telegramUsers)
      .set({ equipped: { ...player.equipped, [slot]: itemId } })
      .where(eq(telegramUsers.id, userId));
  });

  return buildProfile(userId);
}

// ---------------------------------------------------------------------------
// Negozio: monete
// ---------------------------------------------------------------------------

export async function buyWithCoins(userId: number, itemId: string): Promise<Profile> {
  await withTx(async (tx) => {
    const item = await activeItem(tx, itemId);
    if (item.priceCoins === null) {
      throw bad("Oggetto non acquistabile con le monete");
    }

    const player = await lockPlayer(tx, userId);

    if (item.kind !== "coin_pack" && (await owns(tx, userId, item))) {
      throw bad("Oggetto già posseduto");
    }

    await spendCoins(tx, userId, player.coins, item.priceCoins, CoinReason.PURCHASE);
    await grantItem(tx, userId, item, "coins");
  });

  return buildProfile(userId);
}

export async function buyUpgrade(userId: number, upgradeId: string): Promise<Profile> {
  if (!UPGRADE_IDS.includes(upgradeId as UpgradeId)) {
    throw bad("Potenziamento sconosciuto");
  }

  await withTx(async (tx) => {
    const player = await lockPlayer(tx, userId);

    const [row] = await tx
      .select({ level: max(playerUpgrades.level) })
      .from(playerUpgrades)
      .where(
        and(
          eq(playerUpgrades.userId, userId),
          eq(playerUpgrades.upgradeId, upgradeId),
        ),
      );

    const currentLevel = row?.level ?? 0;
    if (currentLevel >= MAX_UPGRADE_LEVEL) {
      throw bad("Potenziamento già al livello massimo");
    }

    const nextLevel = currentLevel + 1;
    const cost = UPGRADE_COSTS[currentLevel];

    await spendCoins(tx, userId, player.coins, cost, CoinReason.PURCHASE);

    await tx
      .insert(playerUpgrades)
      .values({ userId, upgradeId, level: nextLevel, cost });
  });

  return buildProfile(userId);
}

// ---------------------------------------------------------------------------
// Negozio: Stelle Telegram
// ---------------------------------------------------------------------------

function buildInvoiceDescription(item: ItemRow): string {
  if (item.kind === "coin_pack") {
    return `${item.coins ?? 0} monete`;
  }
  if (item.kind === "starter_pack") {
    return "Pacchetto di benvenuto";
  }
  return `Sblocca ${item.name}`;
}

export async function createStarsInvoice(
  userId: number,
  itemId: string,
): Promise<{ invoiceLink: string }> {
  const item = await activeItem(db, itemId);
  if (item.priceStars === null) {
    throw bad("Oggetto non acquistabile con le Stelle");
  }

  if (item.kind !== "coin_pack") {
    const owned = await ownedIds(userId);
    if (owned.has(item.id)) {
      throw bad("Oggetto già posseduto");
    }
  }

  const invoiceLink = await createInvoice(userId, {
    purpose: "item",
    itemId: item.id,
    stars: item.priceStars,
    title: item.name,
    description: buildInvoiceDescription(item),
  });

  return { invoiceLink };
}
