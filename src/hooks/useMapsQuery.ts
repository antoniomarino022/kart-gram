"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { equipMap, buyMapWithCoins, watchAdForMap } from "@/app/actions/mapActions";
import { EquipMapInput, BuyMapInput } from "@/schemas/maps";
import { mapService } from "@/services/mapService";

export const mapQueryKeys = {
  all: ["maps"] as const,
  detail: (id: number) => ["maps", id] as const,
};

/**
 * Hook per recuperare tutte le mappe con TanStack Query
 */
export function useMaps() {
  return useQuery({
    queryKey: mapQueryKeys.all,
    queryFn: () => mapService.getMaps(),
  });
}

/**
 * Hook per recuperare una singola mappa per ID
 */
export function useMap(id: number) {
  return useQuery({
    queryKey: mapQueryKeys.detail(id),
    queryFn: () => mapService.getMapById(id),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * Hook per selezionare una mappa
 * Invalida automaticamente i dati dell'utente per riflettere subito la mappa selezionata
 */
export function useEquipMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EquipMapInput) => equipMap(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
    },
  });
}

/**
 * Hook per acquistare una mappa con le monete
 */
export function useBuyMapWithCoins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyMapInput) => buyMapWithCoins(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}

/**
 * Hook per registrare la visione di un annuncio (ADS) per sbloccare una mappa
 */
export function useWatchAdForMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BuyMapInput) => watchAdForMap(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["user", variables.telegramUserId],
      });
    },
  });
}
