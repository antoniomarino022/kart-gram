import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const paintResponseSchema = z.object({
  id: z.number().int().positive(),
  color: z.string().max(50).nullable(),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const equipPaintSchema = z.object({
  userId: z.number().int().positive(),
  paintId: z.number().int().positive(),
});

export const buyPaintInputSchema = z.object({
  telegramUserId: z.number().int().positive(),
  paintId: z.number().int().positive(),
});

export const paintsListResponseSchema = z.array(paintResponseSchema);

export const createPaintSchema = paintResponseSchema.omit({ id: true });
export const updatePaintSchema = createPaintSchema.partial();

export type PaintResponse = z.infer<typeof paintResponseSchema>;
export type PaintsListResponse = z.infer<typeof paintsListResponseSchema>;
export type CreatePaintInput = z.infer<typeof createPaintSchema>;
export type UpdatePaintInput = z.infer<typeof updatePaintSchema>;
export type EquipPaintInput = z.infer<typeof equipPaintSchema>;
export type BuyPaintInput = z.infer<typeof buyPaintInputSchema>;
