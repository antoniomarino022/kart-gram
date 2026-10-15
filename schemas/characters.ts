import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const characterSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  subtype: z.string().max(50).nullable(),
  bonusStat: z.string().max(100).nullable(),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const createCharacterSchema = characterSchema.omit({ id: true });
export const updateCharacterSchema = createCharacterSchema.partial();

export const characterResponseSchema = characterSchema;
export const charactersListResponseSchema = z.array(characterSchema);

export type Character = z.infer<typeof characterSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CharacterResponse = z.infer<typeof characterResponseSchema>;
