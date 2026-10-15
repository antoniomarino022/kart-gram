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
import { handleActionError } from "@/utils/errors";

/**
 * Avvia una nuova sessione di gioco (Stato: RUNNING)
 */
export async function startGameRun(data: StartGameRunInput): Promise<GameRunResponse> {
  try {
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
  } catch (error) {
    handleActionError(error, "Impossibile avviare la sessione di gioco.");
  }
}

/**
 * Mette in pausa una sessione di gioco attiva (Stato: PAUSED)
 */
export async function pauseGameRun(data: PauseGameRunInput): Promise<GameRunResponse> {
  try {
    const validated = pauseGameRunSchema.parse(data);

    const [run] = await db
      .select()
      .from(gameRuns)
      .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
      .limit(1);

    if (!run) {
      throw new Error("Nessuna partita trovata per questo utente.");
    }

    if (run.status === RunStatus.PAUSED) {
      throw new Error("La partita è già in pausa.");
    }

    if (run.status !== RunStatus.RUNNING) {
      throw new Error(`Impossibile mettere in pausa una partita in stato '${run.status}'.`);
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
  } catch (error) {
    handleActionError(error, "Impossibile mettere in pausa la sessione di gioco.");
  }
}

/**
 * Riprende una sessione precedentemente messa in pausa (Stato: RUNNING)
 */
export async function resumeGameRun(data: ResumeGameRunInput): Promise<GameRunResponse> {
  try {
    const validated = resumeGameRunSchema.parse(data);

    const [run] = await db
      .select()
      .from(gameRuns)
      .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
      .limit(1);

    if (!run) {
      throw new Error("Nessuna partita trovata per questo utente.");
    }

    if (run.status !== RunStatus.PAUSED) {
      throw new Error(`Impossibile riprendere una partita in stato '${run.status}'. Deve essere in PAUSED.`);
    }

    const [updatedRun] = await db
      .update(gameRuns)
      .set({
        status: RunStatus.RUNNING,
      })
      .where(eq(gameRuns.id, run.id))
      .returning();

    return updatedRun;
  } catch (error) {
    handleActionError(error, "Impossibile riprendere la sessione di gioco.");
  }
}

/**
 * Termina la partita con Game Over (Stato: FINISHED)
 */
export async function finishGameRun(data: FinishGameRunInput): Promise<GameRunResponse> {
  try {
    const validated = finishGameRunSchema.parse(data);

    const [run] = await db
      .select()
      .from(gameRuns)
      .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
      .limit(1);

    if (!run) {
      throw new Error("Nessuna partita trovata per questo utente.");
    }

    if (run.status === RunStatus.FINISHED || run.status === RunStatus.ABANDONED) {
      throw new Error(`La partita è già terminata (${run.status}).`);
    }

    if (validated.remainingLives > 0) {
      throw new Error("Impossibile attivare il Game Over finché il giocatore ha vite disponibili.");
    }

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
  } catch (error) {
    handleActionError(error, "Impossibile terminare la sessione di gioco.");
  }
}

/**
 * Abbandona la partita (Stato: ABANDONED)
 */
export async function abandonGameRun(data: AbandonGameRunInput): Promise<GameRunResponse> {
  try {
    const validated = abandonGameRunSchema.parse(data);

    const [run] = await db
      .select()
      .from(gameRuns)
      .where(and(eq(gameRuns.id, validated.runId), eq(gameRuns.userId, validated.userId)))
      .limit(1);

    if (!run) {
      throw new Error("Nessuna partita trovata per questo utente.");
    }

    if (run.status === RunStatus.FINISHED || run.status === RunStatus.ABANDONED) {
      throw new Error(`La partita è già terminata (${run.status}).`);
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
  } catch (error) {
    handleActionError(error, "Impossibile abbandonare la sessione di gioco.");
  }
}
