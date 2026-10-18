import { randomBytes } from "node:crypto";
import { and, asc, eq, max, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  coinTransactions,
  items,
  playerItems,
  playerUpgrades,
  starPayments,
  telegramUsers,
} from "@/db/schema";
import { NO_UPGRADES, type UpgradeLevels } from "@/game/core/sim";
import { DEFAULT_EQUIPPED, isFree, SLOTS } from "@/lib/constants";
import { bad, HttpError } from "@/lib/http";
import { CoinReason } from "@/types/enums";
import type {
  DbClient,
  GrantSource,
  InvoiceRequest,
  ItemRow,
  PlayerRow,
  Profile,
  Slot,
} from "@/types/game";

// ---------------------------------------------------------------------------
// Giocatore e Profilo
// ---------------------------------------------------------------------------

export function playerName(player: Pick<PlayerRow, "displayName" | "username">): string {
  return player.displayName || player.username || "Pilota";
}

export async function getPlayer(userId: number): Promise<PlayerRow> {
  const [row] = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.id, userId))
    .limit(1);

  if (!row) {
    throw new HttpError(404, "Giocatore non trovato");
  }

  return row;
}

/** Riga del giocatore bloccata (SELECT … FOR UPDATE) fino alla fine della transazione. */
export async function lockPlayer(tx: Tx, userId: number): Promise<PlayerRow> {
  const [row] = await tx
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.id, userId))
    .for("update");

  if (!row) {
    throw new HttpError(404, "Giocatore non trovato");
  }

  return row;
}

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

export async function loadItems(opts: { activeOnly: boolean }): Promise<ItemRow[]> {
  const query = db.select().from(items);
  const filtered = opts.activeOnly ? query.where(eq(items.isActive, true)) : query;

  return filtered.orderBy(asc(items.sortOrder), asc(items.id));
}

export async function activeItem(client: DbClient, itemId: string): Promise<ItemRow> {
  const [item] = await client
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.isActive, true)))
    .limit(1);

  if (!item) {
    throw bad("Oggetto sconosciuto");
  }

  return item;
}

export async function owns(client: DbClient, userId: number, item: ItemRow): Promise<boolean> {
  if (isFree(item)) {
    return true;
  }

  const [row] = await client
    .select()
    .from(playerItems)
    .where(and(eq(playerItems.userId, userId), eq(playerItems.itemId, item.id)))
    .limit(1);

  return Boolean(row);
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

// ---------------------------------------------------------------------------
// Monete, Consegna Oggetti e Fatture Stelle
// ---------------------------------------------------------------------------

export async function spendCoins(
  tx: Tx,
  userId: number,
  currentCoins: number,
  cost: number,
  reason: CoinReason,
): Promise<void> {
  if (currentCoins < cost) {
    throw bad("Monete insufficienti");
  }

  if (cost <= 0) {
    return;
  }

  await tx
    .update(telegramUsers)
    .set({ coins: sql`${telegramUsers.coins} - ${cost}` })
    .where(eq(telegramUsers.id, userId));

  await tx
    .insert(coinTransactions)
    .values({ userId, amount: -cost, reason });
}

export async function addCoins(
  tx: Tx,
  userId: number,
  coins: number,
  reason: CoinReason,
  revives = 0,
): Promise<void> {
  if (coins <= 0 && revives <= 0) {
    return;
  }

  await tx
    .update(telegramUsers)
    .set({
      coins: sql`${telegramUsers.coins} + ${coins}`,
      revives: sql`${telegramUsers.revives} + ${revives}`,
    })
    .where(eq(telegramUsers.id, userId));

  if (coins > 0) {
    await tx
      .insert(coinTransactions)
      .values({ userId, amount: coins, reason });
  }
}

export async function grantItem(
  tx: Tx,
  userId: number,
  item: ItemRow,
  source: GrantSource,
): Promise<void> {
  const isPack = item.kind === "coin_pack" || item.kind === "starter_pack";
  const coins = isPack ? (item.coins ?? 0) : 0;
  const revives = item.kind === "starter_pack" ? (item.revives ?? 0) : 0;

  await addCoins(tx, userId, coins, CoinReason.PURCHASE, revives);

  if (item.kind === "coin_pack") {
    return;
  }

  const itemIds = item.kind === "starter_pack"
    ? [item.id, ...(item.grants ?? [])]
    : [item.id];

  await tx
    .insert(playerItems)
    .values(itemIds.map((itemId) => ({ userId, itemId, source })))
    .onConflictDoNothing();
}

export async function createInvoice(userId: number, req: InvoiceRequest): Promise<string> {
  const payload = randomBytes(16).toString("hex");

  await db.insert(starPayments).values({
    userId,
    payload,
    purpose: req.purpose,
    itemId: req.itemId ?? null,
    runId: req.runId ?? null,
    stars: req.stars,
  });

  const { bot } = await import("@/telegram/bot");
  const title = req.title.slice(0, 32);

  return bot.telegram.createInvoiceLink({
    title,
    description: req.description.slice(0, 255),
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: title, amount: req.stars }],
  });
}
