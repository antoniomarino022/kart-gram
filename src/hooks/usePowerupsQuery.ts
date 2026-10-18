"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buyOrUpgradePowerupWithCoins } from "@/app/actions/powerupActions";
import { BuyPowerupInput } from "@/schemas/powerups";
import { powerupService } from "@/services/powerupService";

export const powerupQueryKeys = {
  all: ["powerups"] as const,
  detail: (id: number) => ["powerups", id] as const,
};

/**
 * Hook per recuperare la lista di tutti i powerup con TanStack Query
 */
export function usePowerups() {
  return useQuery({
    queryKey: powerupQueryKeys.all,
    queryFn: () => powerupService.getPowerups(),
  });
}

/**
 * Hook per recuperare un singolo powerup per ID
 */
export function usePowerup(id: number) {
  return useQuery({
    queryKey: powerupQueryKeys.detail(id),
    queryFn: () => powerupService.getPowerupById(id),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * Hook per acquistare o migliorare un powerup con le monete
 */
export function useBuyOrUpgradePowerup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyPowerupInput) => buyOrUpgradePowerupWithCoins(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}
