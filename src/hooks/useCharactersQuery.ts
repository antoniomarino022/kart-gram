"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipCharacter, buyCharacterWithCoins, watchAdForCharacter } from "@/app/actions/characterActions";
import { EquipCharacterInput, BuyCharacterInput } from "@/schemas/characters";
import { characterService } from "@/services/characterService";

export const characterQueryKeys = {
  all: ["characters"] as const,
  detail: (id: number) => ["characters", id] as const,
};

/**
 * Hook per recuperare tutti i personaggi con TanStack Query
 */
export function useCharacters() {
  return useQuery({
    queryKey: characterQueryKeys.all,
    queryFn: () => characterService.getCharacters(),
  });
}

/**
 * Hook per recuperare un singolo personaggio per ID
 */
export function useCharacter(id: number) {
  return useQuery({
    queryKey: characterQueryKeys.detail(id),
    queryFn: () => characterService.getCharacterById(id),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * Hook per equipaggiare un personaggio
 * Invalida automaticamente i dati dell'utente per riflettere subito il personaggio equipaggiato
 */
export function useEquipCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EquipCharacterInput) => equipCharacter(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

/**
 * Hook per acquistare un personaggio con le monete
 */
export function useBuyCharacterWithCoins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyCharacterInput) => buyCharacterWithCoins(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}

/**
 * Hook per registrare la visione di un annuncio (ADS) per sbloccare un personaggio
 */
export function useWatchAdForCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyCharacterInput) => watchAdForCharacter(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}
