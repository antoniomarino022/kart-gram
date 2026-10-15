export interface UserItemResponse {
  id: number;
  userId: number;
  carId: number | null;
  characterId: number | null;
  mapId: number | null;
  unlockedAt: string | Date | null;
}

export type UserItemsListResponse = UserItemResponse[];

export interface UnlockProgressResponse {
  id: number;
  userId: number;
  carId: number | null;
  characterId: number | null;
  mapId: number | null;
  progress: number;
  updatedAt: string | Date | null;
}

export type UnlockProgressListResponse = UnlockProgressResponse[];
