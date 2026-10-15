"use server";

import { db } from "@/db";
import { gameRuns, users } from "@/db/schema";
import {
  startGameRunSchema,
  pauseGameRunSchema,
  resumeGameRunSchema,
  finishGameRunSchema,
  abandonGameRunSchema,
  StartGameRunInput,
  PauseGameRunInput,
  ResumeGameRunInput,
  FinishGameRunInput,
  AbandonGameRunInput,
  GameRunResponse,
} from "@/schemas/runs";
import { RunStatus } from "@/types/enums";
import { and, eq, sql } from "drizzle-orm";

/**
 *  Avvia una nuova sessione di gioco (Stato: RUNNING)
 */
export async function startGameRun(data: StartGameRunInput): Promise<GameRunResponse> {
  const validated = startGameRunSchema.parse(data);

  const [run] = await db
    .insert(gameRuns)
    .values({
      userId: validated.userId,
      carId: validated.carId,
      characterId: validated.characterId,
      mapId: validated.mapId,
      startingLives: validated.startingLives,
      status: RunStatus.RUNNING,
    })
    .returning();

  return run;
}

/**
 * 2. Mette in pausa una sessione di gioco attiva (Stato: PAUSED)
 */
export async function pauseGameRun(data: PauseGameRunInput): Promise<GameRunResponse> {
  const validated = pauseGameRunSchema.parse(data);

  const [run] = await db
    .select()
    .from(gameRuns)
    .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
    .limit(1);

  if (!run) {
    throw new Error("No game run found for this user.");
  }

  if (run.status === RunStatus.PAUSED) {
    throw new Error("The game run is already paused.");
  }

  if (run.status !== RunStatus.RUNNING) {
    throw new Error(`Cannot pause a game run in '${run.status}' state.`);
  }

  const [updatedRun] = await db
    .update(gameRuns)
    .set({
      status: RunStatus.PAUSED,
      score: validated.score,
      coinsCollected: validated.coinsCollected,
    })
    .where(eq(gameRuns.id, run.id))
    .returning();

  return updatedRun;
}

/**
 *  Riprende una sessione precedentemente messa in pausa (Stato: RUNNING)
 */
export async function resumeGameRun(data: ResumeGameRunInput): Promise<GameRunResponse> {
  const validated = resumeGameRunSchema.parse(data);

  const [run] = await db
    .select()
    .from(gameRuns)
    .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
    .limit(1);

  if (!run) {
    throw new Error("No game run found for this user.");
  }

  if (run.status !== RunStatus.PAUSED) {
    throw new Error(`Cannot resume a game run in '${run.status}' state. It must be PAUSED.`);
  }

  const [updatedRun] = await db
    .update(gameRuns)
    .set({
      status: RunStatus.RUNNING,
    })
    .where(eq(gameRuns.id, run.id))
    .returning();

  return updatedRun;
}

/**
 * Termina la partita con Game Over (Stato: FINISHED)
 */
export async function finishGameRun(data: FinishGameRunInput): Promise<GameRunResponse> {
  const validated = finishGameRunSchema.parse(data);


  const [run] = await db
    .select()
    .from(gameRuns)
    .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
    .limit(1);

  if (!run) {
    throw new Error("No game run found for this user.");
  }

  //  la partita non deve essere già conclusa o abbandonata
  if (run.status === RunStatus.FINISHED || run.status === RunStatus.ABANDONED) {
    throw new Error(`The game run has already ended (${run.status}).`);
  }

  //  il Game Over è consentito solo se tutte le vite sono esaurite
  if (validated.remainingLives > 0) {
    throw new Error("Cannot trigger Game Over while the player still has remaining lives.");
  }

  // Aggiorna lo stato della sessione a FINISHED usando solo i dati validati
  const [updatedRun] = await db
    .update(gameRuns)
    .set({
      status: RunStatus.FINISHED,
      score: validated.score,
      coinsCollected: validated.coinsCollected,
      revivesUsed: validated.revivesUsed,
      endedAt: new Date(),
    })
    .where(eq(gameRuns.id, run.id))
    .returning();

  // Accredita le monete raccolte e aggiorna l'all-time high score se superato
  if (validated.coinsCollected > 0 || validated.score > 0) {
    await db
      .update(users)
      .set({
        coins: sql`${users.coins} + ${validated.coinsCollected}`,
        allTimeHighScore: sql`GREATEST(${users.allTimeHighScore}, ${validated.score})`,
      })
      .where(eq(users.id, validated.userId));
  }

  return updatedRun;
}

/**
 *  Abbandona la partita (es. ritorno al menu o uscita prematura) (Stato: ABANDONED)
 */
export async function abandonGameRun(data: AbandonGameRunInput): Promise<GameRunResponse> {
  const validated = abandonGameRunSchema.parse(data);

  const [run] = await db
    .select()
    .from(gameRuns)
    .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
    .limit(1);

  if (!run) {
    throw new Error("No game run found for this user.");
  }

  if (run.status === RunStatus.FINISHED || run.status === RunStatus.ABANDONED) {
    throw new Error(`The game run has already ended (${run.status}).`);
  }

  const [updatedRun] = await db
    .update(gameRuns)
    .set({
      status: RunStatus.ABANDONED,
      score: validated.score,
      coinsCollected: validated.coinsCollected,
      endedAt: new Date(),
    })
    .where(eq(gameRuns.id, run.id))
    .returning();

  return updatedRun;
}

