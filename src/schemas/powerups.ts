import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const powerupResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const buyPowerupInputSchema = z.object({
  telegramUserId: z.number().int().positive(),
  powerupId: z.number().int().positive(),
});

export const powerupsListResponseSchema = z.array(powerupResponseSchema);

export const createPowerupSchema = powerupResponseSchema.omit({ id: true });
export const updatePowerupSchema = createPowerupSchema.partial();

export type PowerupResponse = z.infer<typeof powerupResponseSchema>;
export type PowerupsListResponse = z.infer<typeof powerupsListResponseSchema>;
export type CreatePowerupInput = z.infer<typeof createPowerupSchema>;
export type UpdatePowerupInput = z.infer<typeof updatePowerupSchema>;
export type BuyPowerupInput = z.infer<typeof buyPowerupInputSchema>;
