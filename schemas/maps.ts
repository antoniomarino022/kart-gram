import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const mapSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  mapType: z.string().max(50).nullable(),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const createMapSchema = mapSchema.omit({ id: true });
export const updateMapSchema = createMapSchema.partial();

export const mapResponseSchema = mapSchema;
export const mapsListResponseSchema = z.array(mapSchema);

export type Map = z.infer<typeof mapSchema>;
export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;
export type MapResponse = z.infer<typeof mapResponseSchema>;
