import { pgEnum, pgTable, serial, text, varchar, integer, boolean, timestamp, bigint, date, unique, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  UnlockType,
  ReferralStatus,
  RunStatus,
  LeaderboardType,
  CoinReason,
  PaymentStatus,
  AdPurpose,
} from "@/types/enums";

// enum
export const unlockTypeEnum = pgEnum("unlock_type_enum", [
  UnlockType.FREE,
  UnlockType.COINS,
  UnlockType.STARS,
  UnlockType.SHARES,
  UnlockType.ADS,
]);
export const referralStatusEnum = pgEnum("referral_status_enum", [
  ReferralStatus.PENDING,
  ReferralStatus.QUALIFIED,
]);
export const runStatusEnum = pgEnum("run_status_enum", [
  RunStatus.RUNNING,
  RunStatus.PAUSED,
  RunStatus.FINISHED,
  RunStatus.ABANDONED,
]);
export const leaderboardTypeEnum = pgEnum("leaderboard_type_enum", [
  LeaderboardType.TOP_SCORE,
  LeaderboardType.MOST_LOYAL,
]);
export const coinReasonEnum = pgEnum("coin_reason_enum", [
  CoinReason.RUN,
  CoinReason.PURCHASE,
  CoinReason.MONTHLY_REWARD,
  CoinReason.AD,
  CoinReason.REFERRAL,
  CoinReason.REVIVE,
]);
export const paymentStatusEnum = pgEnum("payment_status_enum", [
  PaymentStatus.PENDING,
  PaymentStatus.COMPLETED,
  PaymentStatus.FAILED,
]);
export const adPurposeEnum = pgEnum("ad_purpose_enum", [
  AdPurpose.REVIVE,
  AdPurpose.UNLOCK_ITEM,
  AdPurpose.COIN_BONUS,
]);

// tables
export const cars = pgTable("Cars", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  carType: varchar("car_type", { length: 50 }),
  speed: integer("speed").notNull(),
  baseLives: integer("base_lives").default(3).notNull(),
  unlockType: unlockTypeEnum("unlock_type").notNull(),
  unlockValue: integer("unlock_value").default(0).notNull(), // Target requirement for unlocking: cost in coins/stars or count of ads/shares required
  isActive: boolean("is_active").default(true).notNull(),
});

export const characters = pgTable("Characters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  subtype: varchar("subtype", { length: 50 }),
  bonusStat: varchar("bonus_stat", { length: 100 }), // Special character perk / modifier (e.g. "+10% coins", "shield_on_start")
  unlockType: unlockTypeEnum("unlock_type").notNull(),
  unlockValue: integer("unlock_value").default(0).notNull(), // Target requirement for unlocking: cost in coins/stars or count of ads/shares required
  isActive: boolean("is_active").default(true).notNull(),
});

export const maps = pgTable("Maps", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  mapType: varchar("map_type", { length: 50 }),
  unlockType: unlockTypeEnum("unlock_type").notNull(),
  unlockValue: integer("unlock_value").default(0).notNull(), // Target requirement to unlock map
  isActive: boolean("is_active").default(true).notNull(),
});


export const telegramUsers = pgTable("Telegram_Users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).unique().notNull(), // Unique Telegram user ID (bigint mapped to JS number)
  username: varchar("username", { length: 100 }),
  profileIcon: text("profile_icon").default("https://placehold.co/150"),
  coins: integer("coins").default(0).notNull(),
  allTimeHighScore: integer("all_time_high_score").default(0).notNull(),
  adsWatchedTotal: integer("ads_watched_total").default(0).notNull(),
  equippedCarId: integer("equipped_car_id").references(() => cars.id, { onDelete: "set null" }), // Currently equipped car
  equippedCharacterId: integer("equipped_character_id").references(() => characters.id, { onDelete: "set null" }), // Currently equipped character
  equippedMapId: integer("equipped_map_id").references(() => maps.id, { onDelete: "set null" }), // Currently selected map
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userItems = pgTable("User_Items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  carId: integer("car_id").references(() => cars.id, { onDelete: "cascade" }), // Populated only if owned item is a car
  characterId: integer("character_id").references(() => characters.id, { onDelete: "cascade" }), // Populated only if owned item is a character
  mapId: integer("map_id").references(() => maps.id, { onDelete: "cascade" }), // Populated only if owned item is a map
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("user_items_item_check", sql`num_nonnulls(${table.carId}, ${table.characterId}, ${table.mapId}) = 1`), // Constraint: exactly one of carId, characterId, or mapId must be non-null
  unique("user_items_user_car_unique").on(table.userId, table.carId),
  unique("user_items_user_char_unique").on(table.userId, table.characterId),
  unique("user_items_user_map_unique").on(table.userId, table.mapId),
  index("idx_user_items_user").on(table.userId),
]);

export const unlockProgress = pgTable("Unlock_Progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  carId: integer("car_id").references(() => cars.id, { onDelete: "cascade" }),
  characterId: integer("character_id").references(() => characters.id, { onDelete: "cascade" }),
  mapId: integer("map_id").references(() => maps.id, { onDelete: "cascade" }),
  progress: integer("progress").default(0).notNull(), // Incremental progress toward milestone unlocks (e.g. 3 out of 5 ads watched)
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("unlock_progress_item_check", sql`num_nonnulls(${table.carId}, ${table.characterId}, ${table.mapId}) = 1`), // Constraint: tracks progress for exactly one item type per row
  unique("unlock_progress_user_car_unique").on(table.userId, table.carId),
  unique("unlock_progress_user_char_unique").on(table.userId, table.characterId),
  unique("unlock_progress_user_map_unique").on(table.userId, table.mapId),
]);


export const referrals = pgTable("Referrals", {
  id: serial("id").primaryKey(),
  inviterUserId: integer("inviter_user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  invitedUserId: integer("invited_user_id").unique().notNull().references(() => telegramUsers.id, { onDelete: "cascade" }), // Unique: a user can only be referred once
  status: referralStatusEnum("status").default(ReferralStatus.PENDING).notNull(), // PENDING (joined), QUALIFIED (met antifraud / played 1st run)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  qualifiedAt: timestamp("qualified_at", { withTimezone: true }), // Timestamp when referral was qualified and rewards were distributed
}, (table) => [
  index("idx_referrals_inviter").on(table.inviterUserId, table.status),
]);


export const gameRuns = pgTable("Game_Runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  carId: integer("car_id").notNull().references(() => cars.id),
  characterId: integer("character_id").notNull().references(() => characters.id),
  mapId: integer("map_id").notNull().references(() => maps.id),
  status: runStatusEnum("status").default(RunStatus.RUNNING).notNull(),
  startingLives: integer("starting_lives").notNull(), // Starting lives at run begin (car base + active perks)
  revivesUsed: integer("revives_used").default(0).notNull(), // Number of revives used during the run (via ads or coins)
  score: integer("score").default(0).notNull(),
  coinsCollected: integer("coins_collected").default(0).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => [
  index("idx_game_runs_user").on(table.userId, table.status),
]);


export const adViews = pgTable("Ad_Views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  purpose: adPurposeEnum("purpose").notNull(), // Ad purpose: REVIVE (in-game revive), UNLOCK_ITEM (unlock progression), COIN_BONUS (free coins)
  carId: integer("car_id").references(() => cars.id, { onDelete: "set null" }),
  characterId: integer("character_id").references(() => characters.id, { onDelete: "set null" }),
  mapId: integer("map_id").references(() => maps.id, { onDelete: "set null" }),
  runId: integer("run_id").references(() => gameRuns.id, { onDelete: "set null" }),
  providerRef: varchar("provider_ref", { length: 255 }).unique(), // Unique ad provider reference ID (for fraud prevention / anti-replay)
  rewardCoins: integer("reward_coins").default(0),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("ad_views_item_check", sql`num_nonnulls(${table.carId}, ${table.characterId}, ${table.mapId}) <= 1`),
]);

export const payments = pgTable("Payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  carId: integer("car_id").references(() => cars.id),
  characterId: integer("character_id").references(() => characters.id),
  mapId: integer("map_id").references(() => maps.id),
  starsAmount: integer("stars_amount").notNull(), // Amount paid in Telegram Stars
  telegramChargeId: varchar("telegram_charge_id", { length: 255 }).unique().notNull(), // Unique Telegram invoice charge ID (for webhook verification)
  status: paymentStatusEnum("status").default(PaymentStatus.PENDING).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  check("payments_item_check", sql`num_nonnulls(${table.carId}, ${table.characterId}, ${table.mapId}) = 1`),
  index("idx_payments_user").on(table.userId, table.status),
]);


export const coinTransactions = pgTable("Coin_Transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // Signed value: positive for earning (+100), negative for spend (-500)
  reason: coinReasonEnum("reason").notNull(),
  refId: integer("ref_id"), // Polymorphic reference ID (e.g. runId for RUN, paymentId for PURCHASE)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_coin_transactions_user").on(table.userId, sql`${table.createdAt} DESC`),
]);


export const monthlyLeaderboards = pgTable("Monthly_Leaderboards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  month: date("month").notNull(), // First day of the reference month (e.g. 2026-10-01) for historical partitioning
  bestScore: integer("best_score").default(0).notNull(), // Monthly high score for "TOP_SCORE" leaderboard
  loyaltyPoints: integer("loyalty_points").default(0).notNull(), // Loyalty score for "MOST_LOYAL" leaderboard (logins, runs, ads)
  daysActive: integer("days_active").default(0).notNull(), // Total unique active days during the month
  lastActiveDate: date("last_active_date"), // Last activity date to prevent multiple increments on the same day
  runsPlayed: integer("runs_played").default(0).notNull(),
  playtimeSeconds: integer("playtime_seconds").default(0).notNull(),
  adsWatchedMonth: integer("ads_watched_month").default(0).notNull(),
}, (table) => [
  unique("monthly_leaderboards_user_month_unique").on(table.userId, table.month),
  index("idx_monthly_best_score").on(table.month, sql`${table.bestScore} DESC`),
  index("idx_monthly_loyalty").on(table.month, sql`${table.loyaltyPoints} DESC`),
]);

export const monthlyRewardsLog = pgTable("Monthly_Rewards_Log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => telegramUsers.id, { onDelete: "cascade" }),
  month: date("month").notNull(),
  leaderboardType: leaderboardTypeEnum("leaderboard_type").notNull(),
  rankPosition: integer("rank_position").notNull(), // Final rank position (strictly restricted between 1 and 10)
  coinsRewarded: integer("coins_rewarded").notNull(),
  isClaimed: boolean("is_claimed").default(false).notNull(), // Flag indicating if the user has claimed this reward
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
}, (table) => [
  check("rank_position_check", sql`${table.rankPosition} BETWEEN 1 AND 10`),
]);

// Better Auth Admin tables
export * from "./auth-schema";
