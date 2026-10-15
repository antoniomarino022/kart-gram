import { z } from "zod";

export const userItemResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  unlockedAt: z.union([z.string(), z.date()]).nullable(),
});

export const unlockProgressResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  progress: z.number().int().default(0),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
});

export const userItemsListResponseSchema = z.array(userItemResponseSchema);
export const unlockProgressListResponseSchema = z.array(unlockProgressResponseSchema);

export type UserItemResponse = z.infer<typeof userItemResponseSchema>;
export type UnlockProgressResponse = z.infer<typeof unlockProgressResponseSchema>;
export type UserItemsListResponse = z.infer<typeof userItemsListResponseSchema>;
export type UnlockProgressListResponse = z.infer<typeof unlockProgressListResponseSchema>;
