import { z } from "zod";
import { unlockTypeEnumSchema } from "./enums";

export const characterResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  subtype: z.string().max(50).nullable(),
  bonusStat: z.string().max(100).nullable(),
  unlockType: unlockTypeEnumSchema,
  unlockValue: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const charactersListResponseSchema = z.array(characterResponseSchema);

export const createCharacterSchema = characterResponseSchema.omit({ id: true });
export const updateCharacterSchema = createCharacterSchema.partial();

export const equipCharacterSchema = z.object({
  userId: z.number().int().positive(),
  characterId: z.number().int().positive(),
});

export const buyCharacterInputSchema = z.object({
  telegramUserId: z.number().int().positive(),
  characterId: z.number().int().positive(),
});

export type CharacterResponse = z.infer<typeof characterResponseSchema>;
export type CharactersListResponse = z.infer<typeof charactersListResponseSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type EquipCharacterInput = z.infer<typeof equipCharacterSchema>;
export type BuyCharacterInput = z.infer<typeof buyCharacterInputSchema>;
