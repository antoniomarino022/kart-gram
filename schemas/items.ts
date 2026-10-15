import { z } from "zod";

export const userItemSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  unlockedAt: z.union([z.string(), z.date()]).nullable(),
});

export const unlockProgressSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive().nullable(),
  characterId: z.number().int().positive().nullable(),
  mapId: z.number().int().positive().nullable(),
  progress: z.number().int().default(0),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
});

export const userItemsListResponseSchema = z.array(userItemSchema);
export const unlockProgressListResponseSchema = z.array(unlockProgressSchema);

export type UserItem = z.infer<typeof userItemSchema>;
export type UnlockProgress = z.infer<typeof unlockProgressSchema>;
