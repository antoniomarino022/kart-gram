import type { UserItemsListResponse, UnlockProgressListResponse } from "./items";
import type { ReferralsListResponse } from "./referrals";

export interface TelegramUserResponse {
  id: number;
  telegramId: number;
  username: string | null;
  profileIcon: string | null;
  coins: number;
  allTimeHighScore: number;
  adsWatchedTotal: number;
  equippedCarId: number | null;
  equippedCharacterId: number | null;
  equippedMapId: number | null;
  createdAt: string | Date | null;
}

export interface TelegramUserProfileResponse {
  user: TelegramUserResponse;
  ownedItems: UserItemsListResponse;
  unlockProgress: UnlockProgressListResponse;
  referrals: ReferralsListResponse;
}
