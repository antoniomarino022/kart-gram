import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const carResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  carType: z.string().max(50).nullable(),
  speed: z.number().int(),
  baseLives: z.number().int().default(3),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const carsListResponseSchema = z.array(carResponseSchema);

export const createCarSchema = carResponseSchema.omit({ id: true });
export const updateCarSchema = createCarSchema.partial();

export const equipCarSchema = z.object({
  userId: z.number().int().positive(),
  carId: z.number().int().positive(),
});

export type CarResponse = z.infer<typeof carResponseSchema>;
export type CarsListResponse = z.infer<typeof carsListResponseSchema>;
export type CreateCarInput = z.infer<typeof createCarSchema>;
export type UpdateCarInput = z.infer<typeof updateCarSchema>;
export type EquipCarInput = z.infer<typeof equipCarSchema>;
