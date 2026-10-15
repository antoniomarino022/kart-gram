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
