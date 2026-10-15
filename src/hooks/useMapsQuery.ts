"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMaps, getMapById, equipMap } from "@/app/actions/mapActions";
import { EquipMapInput } from "@/schemas/maps";

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
    queryFn: () => getMaps(),
  });
}

/**
 * Hook per recuperare una singola mappa per ID
 */
export function useMap(id: number) {
  return useQuery({
    queryKey: mapQueryKeys.detail(id),
    queryFn: () => getMapById(id),
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
