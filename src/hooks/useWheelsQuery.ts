"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipWheel, buyWheelWithCoins, watchAdForWheel } from "@/app/actions/wheelActions";
import { EquipWheelInput, BuyWheelInput } from "@/schemas/wheels";
import { wheelService } from "@/services/wheelService";

export const wheelQueryKeys = {
  all: ["wheels"] as const,
  detail: (id: number) => ["wheels", id] as const,
};

/**
 * Hook per recuperare la lista di tutte le ruote con TanStack Query
 */
export function useWheels() {
  return useQuery({
    queryKey: wheelQueryKeys.all,
    queryFn: () => wheelService.getWheels(),
  });
}

/**
 * Hook per recuperare un singolo set di ruote per ID
 */
export function useWheel(id: number) {
  return useQuery({
    queryKey: wheelQueryKeys.detail(id),
    queryFn: () => wheelService.getWheelById(id),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * Hook per equipaggiare un set di ruote
 */
export function useEquipWheel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EquipWheelInput) => equipWheel(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

/**
 * Hook per acquistare un set di ruote con le monete
 */
export function useBuyWheelWithCoins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyWheelInput) => buyWheelWithCoins(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}

/**
 * Hook per registrare la visione di un annuncio (ADS) per sbloccare un set di ruote
 */
export function useWatchAdForWheel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyWheelInput) => watchAdForWheel(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}
