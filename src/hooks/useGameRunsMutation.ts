"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startGameRun,
  pauseGameRun,
  resumeGameRun,
  finishGameRun,
  abandonGameRun,
} from "@/app/actions/gameRunActions";
import {
  StartGameRunInput,
  PauseGameRunInput,
  ResumeGameRunInput,
  FinishGameRunInput,
  AbandonGameRunInput,
} from "@/schemas/runs";

export const gameRunQueryKeys = {
  active: (userId: number) => ["gameRuns", "active", userId] as const,
  history: (userId: number) => ["gameRuns", "history", userId] as const,
};

/**
 * Hook per avviare una nuova partita
 */
export function useStartGameRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartGameRunInput) => startGameRun(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: gameRunQueryKeys.active(variables.userId),
      });
    },
  });
}

/**
 * Hook per mettere in pausa la partita
 */
export function usePauseGameRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PauseGameRunInput) => pauseGameRun(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: gameRunQueryKeys.active(variables.userId),
      });
    },
  });
}

/**
 * Hook per riprendere la partita in pausa
 */
export function useResumeGameRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ResumeGameRunInput) => resumeGameRun(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: gameRunQueryKeys.active(variables.userId),
      });
    },
  });
}

/**
 * Hook per terminare la partita (Game Over)
 * Invalida automaticamente anche le query dell'utente (per aggiornare monete e record)
 */
export function useFinishGameRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FinishGameRunInput) => finishGameRun(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: gameRunQueryKeys.active(variables.userId),
      });
      // Invalida l'utente per aggiornare monete ed high-score sul client
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["leaderboards"] });
    },
  });
}

/**
 * Hook per abbandonare la partita (uscita prematura)
 */
export function useAbandonGameRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AbandonGameRunInput) => abandonGameRun(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: gameRunQueryKeys.active(variables.userId),
      });
    },
  });
}
