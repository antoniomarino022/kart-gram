import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const wheelResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  capacity: z.number().int(),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const equipWheelSchema = z.object({
  userId: z.number().int().positive(),
  wheelId: z.number().int().positive(),
});

export const buyWheelInputSchema = z.object({
  telegramUserId: z.number().int().positive(),
  wheelId: z.number().int().positive(),
});

export const wheelsListResponseSchema = z.array(wheelResponseSchema);

export const createWheelSchema = wheelResponseSchema.omit({ id: true });
export const updateWheelSchema = createWheelSchema.partial();

export type WheelResponse = z.infer<typeof wheelResponseSchema>;
export type WheelsListResponse = z.infer<typeof wheelsListResponseSchema>;
export type CreateWheelInput = z.infer<typeof createWheelSchema>;
export type UpdateWheelInput = z.infer<typeof updateWheelSchema>;
export type EquipWheelInput = z.infer<typeof equipWheelSchema>;
export type BuyWheelInput = z.infer<typeof buyWheelInputSchema>;
