"use client";

import { useQuery } from "@tanstack/react-query";
import { getCharacters, getCharacterById } from "@/app/actions/characterActions";

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
