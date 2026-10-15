import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const carSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  carType: z.string().max(50).nullable(),
  speed: z.number().int(),
  baseLives: z.number().int().default(3),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const createCarSchema = carSchema.omit({ id: true });
export const updateCarSchema = createCarSchema.partial();

export const carResponseSchema = carSchema;
export const carsListResponseSchema = z.array(carSchema);

export type Car = z.infer<typeof carSchema>;
export type CreateCarInput = z.infer<typeof createCarSchema>;
export type UpdateCarInput = z.infer<typeof updateCarSchema>;
export type CarResponse = z.infer<typeof carResponseSchema>;
