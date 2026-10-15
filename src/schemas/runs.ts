import { z } from "zod";
import { runStatusEnumSchema } from "./enums";
import { RunStatus } from "@/types/enums";

export const gameRunSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  mapId: z.number().int().positive(),
  status: runStatusEnumSchema.default(RunStatus.RUNNING),
  startingLives: z.number().int(),
  revivesUsed: z.number().int().default(0),
  score: z.number().int().default(0),
  distanceMeters: z.number().int().default(0),
  coinsCollected: z.number().int().default(0),
  startedAt: z.union([z.string(), z.date()]).nullable(),
  endedAt: z.union([z.string(), z.date()]).nullable(),
});

export const startGameRunSchema = z.object({
  carId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  mapId: z.number().int().positive(),
  startingLives: z.number().int().default(3),
});

export const updateGameRunSchema = z.object({
  status: runStatusEnumSchema.optional(),
  revivesUsed: z.number().int().optional(),
  score: z.number().int().optional(),
  distanceMeters: z.number().int().optional(),
  coinsCollected: z.number().int().optional(),
  endedAt: z.union([z.string(), z.date()]).optional(),
});

export const gameRunResponseSchema = gameRunSchema;
export const gameRunsListResponseSchema = z.array(gameRunSchema);

export type GameRun = z.infer<typeof gameRunSchema>;
export type StartGameRunInput = z.infer<typeof startGameRunSchema>;
export type UpdateGameRunInput = z.infer<typeof updateGameRunSchema>;
export type GameRunResponse = z.infer<typeof gameRunResponseSchema>;
