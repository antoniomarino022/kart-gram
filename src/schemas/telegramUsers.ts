import { z } from "zod";
import { userItemsListResponseSchema, unlockProgressListResponseSchema } from "./items";
import { referralsListResponseSchema } from "./referrals";

export const telegramUserResponseSchema = z.object({
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

export const createTelegramUserSchema = z.object({
  telegramId: z.number().int(),
  username: z.string().max(100).optional().nullable(),
  profileIcon: z.string().optional().nullable(),
});

export const updateTelegramUserSchema = z.object({
  username: z.string().max(100).optional().nullable(),
  profileIcon: z.string().optional().nullable(),
  equippedCarId: z.number().int().optional().nullable(),
  equippedCharacterId: z.number().int().optional().nullable(),
  equippedMapId: z.number().int().optional().nullable(),
});

export const telegramUserProfileResponseSchema = z.object({
  user: telegramUserResponseSchema,
  ownedItems: userItemsListResponseSchema,
  unlockProgress: unlockProgressListResponseSchema,
  referrals: referralsListResponseSchema,
});

export type TelegramUserResponse = z.infer<typeof telegramUserResponseSchema>;
export type CreateTelegramUserInput = z.infer<typeof createTelegramUserSchema>;
export type UpdateTelegramUserInput = z.infer<typeof updateTelegramUserSchema>;
export type TelegramUserProfileResponse = z.infer<typeof telegramUserProfileResponseSchema>;
