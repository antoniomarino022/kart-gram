import { z } from "zod";

export const userItemResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  paintId: z.number().int().positive().nullable(),
  wheelId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  unlockedAt: z.union([z.string(), z.date()]).nullable(),
});

export const unlockProgressResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  paintId: z.number().int().positive().nullable(),
  wheelId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  progress: z.number().int().default(0),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
});

export const userPowerupResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  powerupId: z.number().int().positive(),
  level: z.number().int().default(1),
  unlockedAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
});

export const userItemsListResponseSchema = z.array(userItemResponseSchema);
export const unlockProgressListResponseSchema = z.array(unlockProgressResponseSchema);
export const userPowerupsListResponseSchema = z.array(userPowerupResponseSchema);

export type UserItemResponse = z.infer<typeof userItemResponseSchema>;
export type UnlockProgressResponse = z.infer<typeof unlockProgressResponseSchema>;
export type UserPowerupResponse = z.infer<typeof userPowerupResponseSchema>;
export type UserItemsListResponse = z.infer<typeof userItemsListResponseSchema>;
export type UnlockProgressListResponse = z.infer<typeof unlockProgressListResponseSchema>;
export type UserPowerupsListResponse = z.infer<typeof userPowerupsListResponseSchema>;
