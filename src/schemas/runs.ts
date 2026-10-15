import { z } from "zod";
import { runStatusEnumSchema } from "./enums";
import { RunStatus } from "@/types/enums";

export const gameRunResponseSchema = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  carId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  mapId: z.number().int().positive(),
  status: runStatusEnumSchema.default(RunStatus.RUNNING),
  startingLives: z.number().int(),
  revivesUsed: z.number().int().default(0),
  score: z.number().int().default(0),
  coinsCollected: z.number().int().default(0),
  startedAt: z.union([z.string(), z.date()]).nullable(),
  endedAt: z.union([z.string(), z.date()]).nullable(),
});

// Input per avviare una nuova run
export const startGameRunSchema = z.object({
  userId: z.number().int().positive(),
  carId: z.number().int().positive(),
  characterId: z.number().int().positive(),
  mapId: z.number().int().positive(),
  startingLives: z.number().int().default(3),
});

// Input per mettere in pausa la run
export const pauseGameRunSchema = z.object({
  runId: z.number().int().positive(),
  userId: z.number().int().positive(),
  score: z.number().int().nonnegative().optional(),
  coinsCollected: z.number().int().nonnegative().optional(),
});

// Input per riprendere la run dalla pausa
export const resumeGameRunSchema = z.object({
  runId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

// Input per terminare la run (Game Over / Vittoria)
export const finishGameRunSchema = z.object({
  runId: z.number().int().positive(),
  userId: z.number().int().positive(),
  score: z.number().int().nonnegative(),
  coinsCollected: z.number().int().nonnegative(),
  revivesUsed: z.number().int().nonnegative().default(0),
  remainingLives: z.number().int().min(0).default(0), // 0 a Game Over (vite esaurite)
});

// Input per abbandonare la run (uscita prematura)
export const abandonGameRunSchema = z.object({
  runId: z.number().int().positive(),
  userId: z.number().int().positive(),
  score: z.number().int().nonnegative().optional(),
  coinsCollected: z.number().int().nonnegative().optional(),
});

// Compatibilità con codice precedente
export const stopGameRunSchema = pauseGameRunSchema;

export const gameRunsListResponseSchema = z.array(gameRunResponseSchema);

export type GameRunResponse = z.infer<typeof gameRunResponseSchema>;
export type GameRunsListResponse = z.infer<typeof gameRunsListResponseSchema>;
export type StartGameRunInput = z.infer<typeof startGameRunSchema>;
export type PauseGameRunInput = z.infer<typeof pauseGameRunSchema>;
export type ResumeGameRunInput = z.infer<typeof resumeGameRunSchema>;
export type FinishGameRunInput = z.infer<typeof finishGameRunSchema>;
export type AbandonGameRunInput = z.infer<typeof abandonGameRunSchema>;
export type StopGameRunInput = z.infer<typeof stopGameRunSchema>;
