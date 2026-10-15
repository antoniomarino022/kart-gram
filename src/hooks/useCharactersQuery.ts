"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCharacters,
  getCharacterById,
  equipCharacter,
} from "@/app/actions/characterActions";
import { EquipCharacterInput } from "@/schemas/characters";

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
    queryFn: () => getCharacters(),
  });
}

/**
 * Hook per recuperare un singolo personaggio per ID
 */
export function useCharacter(id: number) {
  return useQuery({
    queryKey: characterQueryKeys.detail(id),
    queryFn: () => getCharacterById(id),
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
