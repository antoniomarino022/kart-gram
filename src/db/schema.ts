import {
  pgEnum,
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  bigint,
  check,
  index,
  jsonb,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ReferralStatus, CoinReason } from "@/types/enums";

// ---------------------------------------------------------------------------
// Enum PostgreSQL
// ---------------------------------------------------------------------------

export const referralStatusEnum = pgEnum("referral_status_enum", [
  ReferralStatus.PENDING,
  ReferralStatus.QUALIFIED,
]);

export const coinReasonEnum = pgEnum("coin_reason_enum", [
  CoinReason.RUN,
  CoinReason.PURCHASE,
  CoinReason.MONTHLY_REWARD,
  CoinReason.AD,
  CoinReason.REFERRAL,
  CoinReason.REVIVE,
]);

// ---------------------------------------------------------------------------
// Giocatori, Referral e Movimenti Monete
// ---------------------------------------------------------------------------

export const telegramUsers = pgTable("Telegram_Users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique().notNull(),
  username: varchar("username", { length: 100 }),
  displayName: varchar("display_name", { length: 100 }),
  profileIcon: text("profile_icon").default("https://placehold.co/150"),
  coins: integer("coins").default(0).notNull(),
  allTimeHighScore: integer("all_time_high_score").default(0).notNull(),
  adsWatchedTotal: integer("ads_watched_total").default(0).notNull(),
  equipped: jsonb("equipped").$type<Record<string, string>>().default({}).notNull(),
  revives: integer("revives").default(0).notNull(),
  isBanned: boolean("is_banned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const referrals = pgTable("Referrals", {
  id: serial("id").primaryKey(),
  inviterUserId: integer("inviter_user_id")
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "cascade" }),
  invitedUserId: integer("invited_user_id")
    .unique()
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "cascade" }),
  status: referralStatusEnum("status").default(ReferralStatus.PENDING).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
}, (table) => [
  index("idx_referrals_inviter").on(table.inviterUserId, table.status),
]);

export const coinTransactions = pgTable("Coin_Transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: coinReasonEnum("reason").notNull(),
  refId: integer("ref_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_coin_transactions_user").on(table.userId, sql`${table.createdAt} DESC`),
]);

// ---------------------------------------------------------------------------
// Catalogo, Inventario, Partite e Pagamenti Stelle (/api/game e /api/admin)
// ---------------------------------------------------------------------------

/** Catalogo del gioco: kart, vernici, ruote, scie, pacchetti di monete e starter pack. Gli id sono quelli del client (es. "kart_bolt"). */
export const items = pgTable("Items", {
  id: varchar("id", { length: 64 }).primaryKey(),
  kind: varchar("kind", { length: 20 }).notNull(), // kart | paint | wheels | trail | coin_pack | starter_pack
  name: varchar("name", { length: 100 }).notNull(),
  priceCoins: integer("price_coins"), // null = non acquistabile con le monete; 0 = gratis (posseduto da tutti)
  priceStars: integer("price_stars"), // null = non acquistabile con le Stelle
  model: varchar("model", { length: 100 }), // file .glb del modello 3D
  color: varchar("color", { length: 20 }),
  finish: varchar("finish", { length: 10 }), // flat | metal | neon
  coins: integer("coins"), // monete date da coin_pack / starter_pack
  revives: integer("revives"), // revive dati dallo starter_pack
  grants: jsonb("grants").$type<string[]>(), // oggetti dati dallo starter_pack
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("items_kind_check", sql`${table.kind} IN ('kart', 'paint', 'wheels', 'trail', 'coin_pack', 'starter_pack')`),
  check("items_prices_check", sql`coalesce(${table.priceCoins}, 0) >= 0 AND coalesce(${table.priceStars}, 1) > 0`),
]);

/** Oggetti posseduti (oltre a quelli gratuiti, che tutti possiedono). */
export const playerItems = pgTable("Player_Items", {
  userId: integer("user_id")
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "cascade" }),
  itemId: varchar("item_id", { length: 64 })
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  source: varchar("source", { length: 10 }).notNull(), // coins | stars | grant | admin
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.itemId] }),
]);

/** Un record per ogni livello di potenziamento comprato: il livello attuale è il massimo. La chiave impedisce di pagare due volte lo stesso livello. */
export const playerUpgrades = pgTable("Player_Upgrades", {
  userId: integer("user_id")
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "cascade" }),
  upgradeId: varchar("upgrade_id", { length: 20 }).notNull(), // turbo | magnet | slowmo | x2
  level: integer("level").notNull(),
  cost: integer("cost").notNull(),
  boughtAt: timestamp("bought_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.upgradeId, table.level] }),
  check("player_upgrades_level_check", sql`${table.level} BETWEEN 1 AND 5`),
]);

/** Partite: seed deciso dal server, stato fissato all'avvio (upgrade, ruote) e risultato ricalcolato rigiocando gli input. */
export const runs = pgTable("Runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "cascade" }),
  seed: integer("seed").notNull(),
  status: varchar("status", { length: 10 }).default("running").notNull(), // running | finished | expired
  upgrades: jsonb("upgrades").$type<Record<string, number>>().notNull(),
  wheels: varchar("wheels", { length: 64 }).notNull(),
  revived: boolean("revived").default(false).notNull(),
  score: integer("score"),
  coins: integer("coins"),
  distance: integer("distance"),
  ticks: integer("ticks"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  index("idx_runs_user").on(table.userId, table.startedAt),
  index("idx_runs_finished").on(table.finishedAt, table.score),
]);

/** Pagamenti in Stelle Telegram: creati con la fattura, completati dal webhook successful_payment. */
export const starPayments = pgTable("Star_Payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => telegramUsers.id, { onDelete: "restrict" }),
  payload: varchar("payload", { length: 64 }).unique().notNull(),
  purpose: varchar("purpose", { length: 10 }).notNull(), // item | revive
  itemId: varchar("item_id", { length: 64 }).references(() => items.id, { onDelete: "set null" }),
  runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
  stars: integer("stars").notNull(),
  status: varchar("status", { length: 10 }).default("pending").notNull(), // pending | paid | refunded
  telegramChargeId: varchar("telegram_charge_id", { length: 255 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
}, (table) => [
  check("star_payments_stars_check", sql`${table.stars} > 0`),
  index("idx_star_payments_user").on(table.userId, table.createdAt),
]);

// Better Auth Admin tables
export * from "./auth-schema";
