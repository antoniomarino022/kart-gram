export interface UserItemResponse {
  id: number;
  userId: number;
  carId: number | null;
  paintId: number | null;
  wheelId: number | null;
  characterId: number | null;
  mapId: number | null;
  unlockedAt: string | Date | null;
}

export type UserItemsListResponse = UserItemResponse[];

export interface UnlockProgressResponse {
  id: number;
  userId: number;
  carId: number | null;
  paintId: number | null;
  wheelId: number | null;
  characterId: number | null;
  mapId: number | null;
  progress: number;
  updatedAt: string | Date | null;
}

export type UnlockProgressListResponse = UnlockProgressResponse[];

export interface UserPowerupResponse {
  id: number;
  userId: number;
  powerupId: number;
  level: number;
  unlockedAt: string | Date | null;
  updatedAt: string | Date | null;
}

export type UserPowerupsListResponse = UserPowerupResponse[];
