import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const mapResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  mapType: z.string().max(50).nullable(),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const mapsListResponseSchema = z.array(mapResponseSchema);

export const createMapSchema = mapResponseSchema.omit({ id: true });
export const updateMapSchema = createMapSchema.partial();

export const equipMapSchema = z.object({
  userId: z.number().int().positive(),
  mapId: z.number().int().positive(),
});

export type MapResponse = z.infer<typeof mapResponseSchema>;
export type MapsListResponse = z.infer<typeof mapsListResponseSchema>;
export type CreateMapInput = z.infer<typeof createMapSchema>;
export type UpdateMapInput = z.infer<typeof updateMapSchema>;
export type EquipMapInput = z.infer<typeof equipMapSchema>;
