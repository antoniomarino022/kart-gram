import { LeaderboardType } from "./enums";

export interface MonthlyLeaderboardResponse {
  id: number;
  userId: number;
  month: string;
  bestScore: number;
  loyaltyPoints: number;
  daysActive: number;
  lastActiveDate: string | null;
  runsPlayed: number;
  playtimeSeconds: number;
  adsWatchedMonth: number;
}

export type MonthlyLeaderboardsListResponse = MonthlyLeaderboardResponse[];

export interface MonthlyRewardsLogResponse {
  id: number;
  userId: number;
  month: string;
  leaderboardType: LeaderboardType;
  rankPosition: number;
  coinsRewarded: number;
  isClaimed: boolean;
  claimedAt: string | Date | null;
}

export type MonthlyRewardsLogListResponse = MonthlyRewardsLogResponse[];

export interface TopScoreLeaderboardEntry {
  rank: number;
  userId: number;
  telegramId: number;
  username: string | null;
  profileIcon: string | null;
  score: number;
}

export interface MostLoyalLeaderboardEntry {
  rank: number;
  userId: number;
  telegramId: number;
  username: string | null;
  profileIcon: string | null;
  sharesCount: number;
}

export interface LeaderboardsOverviewResponse {
  topScore: TopScoreLeaderboardEntry[];
  mostLoyal: MostLoyalLeaderboardEntry[];
}
