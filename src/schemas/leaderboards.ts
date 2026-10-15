import { z } from "zod";
import { leaderboardTypeEnumSchema } from "./enums";

export const monthlyLeaderboardSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  month: z.string(), // YYYY-MM-DD
  bestScore: z.number().int().default(0),
  loyaltyPoints: z.number().int().default(0),
  daysActive: z.number().int().default(0),
  lastActiveDate: z.string().nullable(),
  runsPlayed: z.number().int().default(0),
  playtimeSeconds: z.number().int().default(0),
  adsWatchedMonth: z.number().int().default(0),
});

export const monthlyRewardsLogSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  month: z.string(),
  leaderboardType: leaderboardTypeEnumSchema,
  rankPosition: z.number().int().min(1).max(10),
  coinsRewarded: z.number().int(),
  isClaimed: z.boolean().default(false),
  claimedAt: z.union([z.string(), z.date()]).nullable(),
});

export const monthlyLeaderboardsListResponseSchema = z.array(monthlyLeaderboardSchema);
export const monthlyRewardsLogListResponseSchema = z.array(monthlyRewardsLogSchema);

export type MonthlyLeaderboard = z.infer<typeof monthlyLeaderboardSchema>;
export type MonthlyRewardsLog = z.infer<typeof monthlyRewardsLogSchema>;
