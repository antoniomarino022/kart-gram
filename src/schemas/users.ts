import { z } from "zod";

export const userResponseSchema = z.object({
  id: z.number().int().positive(),
  telegramId: z.number().int(),
  username: z.string().max(100).nullable(),
  profileIcon: z.string().nullable().default("https://placehold.co/150"),
  coins: z.number().int().default(0),
  allTimeHighScore: z.number().int().default(0),
  adsWatchedTotal: z.number().int().default(0),
  equippedCarId: z.number().int().nullable(),
  equippedCharacterId: z.number().int().nullable(),
  equippedMapId: z.number().int().nullable(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
});

export const createUserSchema = z.object({
  telegramId: z.number().int(),
  username: z.string().max(100).optional().nullable(),
  profileIcon: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  username: z.string().max(100).optional().nullable(),
  profileIcon: z.string().optional().nullable(),
  equippedCarId: z.number().int().optional().nullable(),
  equippedCharacterId: z.number().int().optional().nullable(),
  equippedMapId: z.number().int().optional().nullable(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
