import { z } from "zod";
import { leaderboardTypeEnumSchema } from "./enums";

export const monthlyLeaderboardResponseSchema = z.object({
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

export const monthlyRewardsLogResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  month: z.string(),
  leaderboardType: leaderboardTypeEnumSchema,
  rankPosition: z.number().int().min(1).max(10),
  coinsRewarded: z.number().int(),
  isClaimed: z.boolean().default(false),
  claimedAt: z.union([z.string(), z.date()]).nullable(),
});

export const monthlyLeaderboardsListResponseSchema = z.array(monthlyLeaderboardResponseSchema);
export const monthlyRewardsLogListResponseSchema = z.array(monthlyRewardsLogResponseSchema);

export type MonthlyLeaderboardResponse = z.infer<typeof monthlyLeaderboardResponseSchema>;
export type MonthlyRewardsLogResponse = z.infer<typeof monthlyRewardsLogResponseSchema>;
export type MonthlyLeaderboardsListResponse = z.infer<typeof monthlyLeaderboardsListResponseSchema>;
export type MonthlyRewardsLogListResponse = z.infer<typeof monthlyRewardsLogListResponseSchema>;

export const topScoreLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1).max(10),
  userId: z.number().int().positive(),
  telegramId: z.number().int(),
  username: z.string().nullable(),
  profileIcon: z.string().nullable(),
  score: z.number().int().default(0),
});

export const mostLoyalLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1).max(10),
  userId: z.number().int().positive(),
  telegramId: z.number().int(),
  username: z.string().nullable(),
  profileIcon: z.string().nullable(),
  sharesCount: z.number().int().default(0),
});

export const leaderboardsOverviewResponseSchema = z.object({
  topScore: z.array(topScoreLeaderboardEntrySchema),
  mostLoyal: z.array(mostLoyalLeaderboardEntrySchema),
});

export type TopScoreLeaderboardEntry = z.infer<typeof topScoreLeaderboardEntrySchema>;
export type MostLoyalLeaderboardEntry = z.infer<typeof mostLoyalLeaderboardEntrySchema>;
export type LeaderboardsOverviewResponse = z.infer<typeof leaderboardsOverviewResponseSchema>;
